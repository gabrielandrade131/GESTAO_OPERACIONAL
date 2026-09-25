"""Read-only, token-authenticated SBM integration. No browser credentials."""
import inspect
import json
import logging
import os
import secrets
from collections import Counter
from datetime import date, timedelta
from django.http import JsonResponse, HttpRequest, QueryDict
from django.views.decorators.http import require_GET
from django.utils import timezone
from django.core.cache import cache
from GO.models import Cliente, OrdemServico
from GO import dashboard_views as daily
from GO import views_dashboard_rdo as original
from django.conf import settings
from .tank_summary import tank_operations

CLIENT_NAME = "SBM OFFSHORE"
COMPLETED_CAROUSEL_OS = {6370}
ALLOWED = {"start", "end", "unidade", "os", "supervisor", "status"}
SERIES = (
    ("hh_confinado", "HH em Espaço Confinado", "line", "Horas", daily.rdo_soma_hh_confinado_por_dia),
    ("hh_fora", "HH Fora de Espaço Confinado", "line", "Horas", daily.rdo_soma_hh_fora_confinado_por_dia),
    ("ensacamento", "Ensacamento por Dia", "bar", "Unidades", daily.rdo_ensacamento_por_dia),
    ("tambores", "Tambores Gerados por Dia", "bar", "Unidades", daily.rdo_tambores_por_dia),
    ("liquido", "M³ Resíduo Líquido Removido", "bar", "M³", daily.rdo_residuos_liquido_por_dia),
    ("solido", "M³ Resíduo Sólido Removido", "bar", "M³", daily.rdo_residuos_solido_por_dia),
)
logger = logging.getLogger(__name__)


def scoped_orders():
    # Resolve the UNIQUE exact name verified on the VPS (currently PK 9).
    client = Cliente.objects.get(nome=CLIENT_NAME)
    return OrdemServico.objects.filter(Cliente_id=client.pk)


def filter_options(orders):
    def options(field, label=None):
        return [{"value": str(value), "label": str(text)}
                for value, text in orders.order_by(field).values_list(field, label or field).distinct()
                if value not in (None, "")]
    return {
        "unidade": options("Unidade_id", "Unidade__nome"),
        "os": options("pk", "numero_os"),
        "supervisor": options("supervisor__username"),
        "status": options("status_operacao"),
    }


def validated_filters(query, options):
    if set(query) - ALLOWED or any(len(query.getlist(k)) != 1 for k in query):
        raise ValueError()
    start_value = query.get("start")
    end_value = query.get("end")
    if bool(start_value) != bool(end_value):
        raise ValueError()
    start = date.fromisoformat(start_value) if start_value else None
    end = date.fromisoformat(end_value) if end_value else None
    if start and end and (start > end or (end - start).days > 366):
        raise ValueError()
    filters = {}
    if start and end:
        filters.update({"start": start.isoformat(), "end": end.isoformat()})
    for key in ("unidade", "os", "supervisor", "status"):
        value = query.get(key)
        if value:
            if value not in {item["value"] for item in options[key]}:
                raise ValueError()
            filters[key] = value
    return filters


def build_payload(filters, options, orders):
    mapping = {"unidade": "Unidade_id", "os": "pk",
               "supervisor": "supervisor__username", "status": "status_operacao"}
    for key, field in mapping.items():
        if filters.get(key):
            orders = orders.filter(**{field: filters[key]})
    summary_params = {"cliente": CLIENT_NAME}
    summary_params.update({key: filters[key] for key in ("start", "end") if key in filters})
    summary_params.update({key: filters[key] for key in mapping if filters.get(key) and key != "os"})
    if filters.get("os"):
        summary_params["os_existente"] = filters["os"]
    summary = [row for row in original.summary_operations_data(summary_params)
               if row.get("cliente") == CLIENT_NAME]
    # Status cards are historical KPIs: the selected date range must not
    # reduce them. Operational/unit/status filters still apply.
    card_params = {"cliente": CLIENT_NAME}
    card_params.update({key: filters[key] for key in mapping if filters.get(key) and key != "os"})
    if filters.get("os"):
        card_params["os_existente"] = filters["os"]
    card_summary = summary if card_params == summary_params else [
        row for row in original.summary_operations_data(card_params)
        if row.get("cliente") == CLIENT_NAME]
    status_counts = Counter(row.get("status") or "Sem status" for row in card_summary)
    status_order = ("Programada", "Em Andamento", "Paralizada", "Finalizada", "Cancelada")
    status_cards = [{"status": status, "count": status_counts.get(status, 0),
                     "orders": [{"os": row.get("numero_os"), "label": f"{row.get('numero_os')} - {status}"}
                                for row in card_summary if row.get("status") == status][:8]}
                    for status in status_order]
    movement_rows = [{"os": row.get("numero_os"), "movements": row.get("rdos_count", 0)}
                     for row in summary]
    # A new internal request cannot carry browser-supplied client/OS aliases.
    request = HttpRequest()
    request.method = "GET"
    request.GET = QueryDict("", mutable=True)
    request.GET.update({k: filters[k] for k in ("start", "end") if k in filters})
    # Every reused dashboard view must receive the same fixed client scope as
    # the operation summary. Without this, a view can fall back to the global
    # RDO queryset and mix other customers into the SBM charts.
    request.GET["cliente"] = CLIENT_NAME
    request.GET["group"] = "day"
    def calculate(view):
        # Authorization was verified at this endpoint; reuse calculation bodies,
        # without constructing a fake user or weakening the original decorators.
        response = inspect.unwrap(view)(request, orders=orders)
        data = json.loads(response.content)
        if response.status_code != 200 or data.get("success") is not True:
            raise RuntimeError("source_calculation_failed")
        return data
    charts = []
    for key, title, kind, unit, view in SERIES:
        data = calculate(view)
        charts.append({"id": key, "title": title, "type": kind, "unit": unit,
                       "labels": data["labels"], "datasets": data["datasets"]})
    methods = calculate(original.metodos_eficacia_por_dias)
    pob = calculate(original.pob_comparativo)
    charts.append({"id": "pob", "title": "Média de POB alocado na atividade x POB em espaço confinado (mês)",
                   "type": "bar", "unit": "Pessoas",
                   "meta": {"period_rdos": sum(row.get("rdos_count", 0) for row in summary),
                            "period_os": len(summary)},
                   **{k: pob["chart"][k] for k in ("labels", "datasets")}})
    methods.pop("success", None)
    # Reuse the Report Diário calculation so the dashboard shows the same
    # cumulative compartment progress for active SBM operations plus the
    # requested completed reference operation. Existing filters still apply.
    tank_progress = []
    seen_tank_progress = set()
    seen_completed_orders = set()
    for row in summary:
        if row.get("status") != "Em Andamento" and not (
            row.get("status") == "Finalizada" and row.get("numero_os") in COMPLETED_CAROUSEL_OS
        ):
            continue
        os_id = row.get("id")
        if not os_id:
            continue
        if row.get("status") == "Finalizada":
            if row.get("numero_os") in seen_completed_orders:
                continue
            seen_completed_orders.add(row.get("numero_os"))
        base_request = HttpRequest()
        base_request.method = "GET"
        base_request.GET = QueryDict("", mutable=True)
        base_request.GET["os_id"] = str(os_id)
        base_response = original.report_diario_data(base_request)
        base = json.loads(base_response.content)
        tanks = base.get("tanques_disponiveis", []) if base.get("success") else []
        for tank in tanks:
            if row.get("numero_os") == 6370 and str(tank).strip().upper() != "4C COT":
                continue
            tank_request = HttpRequest()
            tank_request.method = "GET"
            tank_request.GET = QueryDict("", mutable=True)
            tank_request.GET["os_id"] = str(os_id)
            tank_request.GET["tanque"] = str(tank)
            tank_response = original.report_diario_data(tank_request)
            tank_data = json.loads(tank_response.content)
            chart = tank_data.get("tanque_3d") if tank_data.get("success") else None
            if not chart or not chart.get("available"):
                continue
            source_rows = chart.get("compartimentos") or chart.get("chart", {}).get("items", [])
            has_progress = any(float(item.get("avanco", item.get("value", 0)) or 0) > 0 for item in source_rows)
            if not source_rows or not has_progress:
                continue
            progress_key = (row.get("numero_os"), str(tank))
            if progress_key in seen_tank_progress:
                continue
            seen_tank_progress.add(progress_key)
            tank_progress.append({
                "os": row.get("numero_os"), "os_id": os_id,
                "unidade": row.get("unidade") or "", "tanque": str(tank),
                "status": row.get("status") or "",
                "source_date": chart.get("source_date") or "",
                "sentido_inicio": chart.get("sentido_inicio") or "",
                "sentido_fim": chart.get("sentido_fim") or "",
                "total_percent": chart.get("total_percent", 0),
                "compartimentos": source_rows,
            })
    return {"client": CLIENT_NAME, "updated_at": timezone.now().isoformat(),
            "filters": options, "applied_filters": filters,
            "data": {"charts": charts, "methods": methods,
                     "kpis": {"total_os": len(card_summary), "status_cards": status_cards,
                              "movements_total": sum(row["movements"] for row in movement_rows),
                              "movements_by_os": movement_rows},
                     "operations": summary, "tank_operations": tank_operations(orders, filters),
                     "tank_progress": tank_progress}}


@require_GET
def dashboard(request):
    token = os.environ.get("SYNCHRO_API_TOKEN", getattr(settings, "SYNCHRO_INTEGRATION_KEY", ""))
    if not token or not secrets.compare_digest(request.headers.get("Authorization", ""), "Bearer " + token):
        return JsonResponse({"error": "Acesso negado."}, status=403)
    try:
        orders = scoped_orders()
        options = filter_options(orders)
        filters = validated_filters(request.GET, options)
    except (ValueError, TypeError):
        return JsonResponse({"error": "Filtros inválidos."}, status=400)
    except Exception:
        logger.error("SBM integration scope unavailable")
        return JsonResponse({"error": "Integração indisponível."}, status=503)
    # Cache is owned by the consuming server. A global short lock limits expensive
    # concurrent computations even across distinct filter combinations.
    if not cache.add("synchro-sbm:compute", True, 90):
        return JsonResponse({"error": "Atualização em andamento."}, status=503)
    try:
        return JsonResponse(build_payload(filters, options, orders))
    except Exception:
        logger.error("SBM integration calculation failed")
        return JsonResponse({"error": "Integração indisponível."}, status=503)
    finally:
        cache.delete("synchro-sbm:compute")

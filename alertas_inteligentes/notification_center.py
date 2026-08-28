from datetime import datetime, time, timedelta, timezone as datetime_timezone
from urllib.parse import urlencode
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db import transaction
from django.db.models import Exists, OuterRef, Q
from django.db.models.functions import Coalesce
from django.urls import reverse
from django.utils import timezone

from .models import (
    AlertaInteligente,
    AlertaOperacionalInteligente,
    LeituraAlertaIA,
)


PAGE_SIZE_DEFAULT = 20
PAGE_SIZE_MAX = 50

RDO_GROUP_SOURCE_BY_MODE = {
    "all": "rdo_grupo_todos",
    "active": "rdo_grupo_ativos",
    "corrected": "rdo_grupo_corrigidos",
}
RDO_GROUP_MODE_BY_SOURCE = {
    source: mode for mode, source in RDO_GROUP_SOURCE_BY_MODE.items()
}
PRIORITY_ORDER = {"critica": 0, "alta": 1, "media": 2, "baixa": 3}
AI_DISPLAY_TIMEZONE = ZoneInfo(
    getattr(settings, "AI_DISPLAY_TIME_ZONE", "America/Sao_Paulo")
)

RDO_ALERT_SECTION_MAP = {
    "RDO_SEM_TURNO": "identificacao",
    "RDO_DATA_PULADA": "identificacao",
    "RDO_DUPLICADO": "identificacao",
    "PT_SEM_TURNO": "pt",
    "PT_SEM_NUMERO": "pt",
    "PT_INCOERENTE": "pt",
    "ATIVIDADE_SEM_HORARIO": "atividades",
    "ATIVIDADE_SOBREPOSTA": "atividades",
    "ESPACO_CONFINADO_SEM_HORARIO": "tanque",
    "ESPACO_CONFINADO_INCOERENTE": "tanque",
    "RDO_TANQUE_INCOMPLETO": "tanque",
    "OPERADORES_MAIOR_EQUIPE": "equipe",
    "VALOR_DIARIO_MAIOR_PREVISAO": "operacionais",
    "AVANCO_INVALIDO": "operacionais",
    "FOTO_AUSENTE": "equipe",
    "OBSERVACAO_INCOERENTE": "equipe",
    "RDO_OUTLIER": "identificacao",
    "RDO_REVISAR_ANOMALIA": "identificacao",
}


def ai_localtime(value=None):
    value = value or timezone.now()
    if timezone.is_naive(value):
        value = timezone.make_aware(value, datetime_timezone.utc)
    return timezone.localtime(value, AI_DISPLAY_TIMEZONE)


def _period_filter():
    today = ai_localtime().date()
    start = datetime.combine(
        today - timedelta(days=1),
        time.min,
        tzinfo=AI_DISPLAY_TIMEZONE,
    )
    end = datetime.combine(
        today + timedelta(days=1),
        time.min,
        tzinfo=AI_DISPLAY_TIMEZONE,
    )
    return {
        "criado_em__gte": start,
        "criado_em__lt": end,
    }


def _is_supervisor(user):
    return bool(
        user
        and getattr(user, "is_authenticated", False)
        and not getattr(user, "is_superuser", False)
        and user.groups.filter(name="Supervisor").exists()
    )


def accessible_alert_querysets(
    user,
    *,
    daily_only=False,
    include_corrected=False,
    corrected_only=False,
):
    """Return both AI alert sources, optionally restricted to the daily preview."""
    period = _period_filter() if daily_only else {}
    if corrected_only:
        status_filter = Q(status="resolvido", motivo_encerramento="correcao_confirmada")
    elif include_corrected:
        status_filter = Q(status="pendente") | Q(
            status="resolvido",
            motivo_encerramento="correcao_confirmada",
        )
    else:
        status_filter = Q(status="pendente")

    rdo_qs = (
        AlertaInteligente.objects.filter(status_filter, **period)
        .select_related(
            "rdo",
            "rdo__ordem_servico",
            "rdo__ordem_servico__Cliente",
            "rdo__ordem_servico__Unidade",
            "corrigido_por",
        )
        .annotate(notification_sort_at=Coalesce("corrigido_em", "criado_em"))
        .order_by("-notification_sort_at", "-id")
    )
    operational_qs = (
        AlertaOperacionalInteligente.objects.filter(status_filter, **period)
        .select_related(
            "ordem_servico",
            "ordem_servico__Cliente",
            "ordem_servico__Unidade",
            "corrigido_por",
        )
        .annotate(notification_sort_at=Coalesce("corrigido_em", "criado_em"))
        .order_by("-notification_sort_at", "-id")
    )
    # Supervisors already see only their own operational context on the RDO
    # screen. Preserve that restriction in the notification APIs as well.
    if _is_supervisor(user):
        rdo_qs = rdo_qs.filter(rdo__ordem_servico__supervisor=user)
        operational_qs = operational_qs.filter(ordem_servico__supervisor=user)
    return rdo_qs, operational_qs


def _with_read_state(queryset, user, source):
    receipt_filter = {
        "usuario": user,
        "lido": True,
        "alerta_rdo_id" if source == "rdo" else "alerta_operacional_id": OuterRef("pk"),
    }
    any_prior_read_filter = {
        "lido": True,
        "lido_em__lte": OuterRef("corrigido_em"),
        "alerta_rdo_id" if source == "rdo" else "alerta_operacional_id": OuterRef("pk"),
    }
    return queryset.annotate(
        user_has_read=Exists(LeituraAlertaIA.objects.filter(**receipt_filter)),
        was_read_before_correction=Exists(
            LeituraAlertaIA.objects.filter(**any_prior_read_filter)
        ),
    )


def _apply_database_filters(queryset, source, query, priority, alert_type):
    if priority:
        queryset = queryset.filter(prioridade=priority)
    if alert_type:
        queryset = queryset.filter(tipo=alert_type)
    if not query:
        return queryset
    if source == "rdo":
        searchable = (
            Q(mensagem__icontains=query)
            | Q(tipo__icontains=query)
            | Q(referencia__icontains=query)
            | Q(rdo__rdo__icontains=query)
            | Q(rdo__ordem_servico__numero_os__icontains=query)
            | Q(rdo__ordem_servico__Cliente__nome__icontains=query)
            | Q(rdo__ordem_servico__Unidade__nome__icontains=query)
        )
    else:
        searchable = (
            Q(mensagem__icontains=query)
            | Q(tipo__icontains=query)
            | Q(referencia__icontains=query)
            | Q(ordem_servico__numero_os__icontains=query)
            | Q(ordem_servico__Cliente__nome__icontains=query)
            | Q(ordem_servico__Unidade__nome__icontains=query)
        )
    return queryset.filter(searchable)


def _serialize_annotated(source, alerts):
    return [serialize_alert(source, alert, bool(alert.user_has_read)) for alert in alerts]


def _read_keys(user, rdo_ids, operational_ids):
    keys = set()
    if rdo_ids:
        keys.update(
            ("rdo", object_id)
            for object_id in LeituraAlertaIA.objects.filter(
                usuario=user,
                alerta_rdo_id__in=rdo_ids,
                lido=True,
            ).values_list("alerta_rdo_id", flat=True)
        )
    if operational_ids:
        keys.update(
            ("operacional", object_id)
            for object_id in LeituraAlertaIA.objects.filter(
                usuario=user,
                alerta_operacional_id__in=operational_ids,
                lido=True,
            ).values_list("alerta_operacional_id", flat=True)
        )
    return keys


def _safe_name(value):
    if not value:
        return ""
    return str(getattr(value, "nome", None) or value)


def _user_display_name(user):
    if not user:
        return ""
    try:
        full_name = user.get_full_name().strip()
    except Exception:
        full_name = ""
    return full_name or getattr(user, "username", "") or str(user)


def _format_elapsed(start, end):
    if not start or not end:
        return ""
    seconds = max(0, int((end - start).total_seconds()))
    days, remainder = divmod(seconds, 86400)
    hours, remainder = divmod(remainder, 3600)
    minutes, _ = divmod(remainder, 60)
    parts = []
    if days:
        parts.append(f"{days}d")
    if hours or days:
        parts.append(f"{hours}h")
    parts.append(f"{minutes}min")
    return " ".join(parts)


def _corrected_metrics(rdo_qs, operational_qs):
    corrected_rdo = rdo_qs.filter(
        status="resolvido",
        motivo_encerramento="correcao_confirmada",
    )
    corrected_operational = operational_qs.filter(
        status="resolvido",
        motivo_encerramento="correcao_confirmada",
    )
    total = corrected_rdo.count() + corrected_operational.count()
    without_prior_read = (
        corrected_rdo.filter(was_read_before_correction=False).count()
        + corrected_operational.filter(was_read_before_correction=False).count()
    )
    identified_user = (
        corrected_rdo.filter(corrigido_por__isnull=False).count()
        + corrected_operational.filter(corrigido_por__isnull=False).count()
    )
    elapsed_seconds = []
    for queryset in (corrected_rdo, corrected_operational):
        for created_at, corrected_at in queryset.values_list("criado_em", "corrigido_em"):
            if created_at and corrected_at:
                elapsed_seconds.append(max(0, int((corrected_at - created_at).total_seconds())))
    average_seconds = int(sum(elapsed_seconds) / len(elapsed_seconds)) if elapsed_seconds else 0
    average_time = ""
    if elapsed_seconds:
        average_time = _format_elapsed(
            timezone.now(),
            timezone.now() + timedelta(seconds=average_seconds),
        )
    return {
        "total": total,
        "without_prior_read": without_prior_read,
        "with_identified_user": identified_user,
        "average_correction_time": average_time,
    }


def serialize_alert(source, alert, is_read=False):
    target_section = ""
    if source == "rdo":
        rdo = alert.rdo
        os_obj = getattr(rdo, "ordem_servico", None)
        rdo_number = getattr(rdo, "rdo", None) or getattr(rdo, "numero_rdo", None) or rdo.pk
        target_section = RDO_ALERT_SECTION_MAP.get(alert.tipo, "identificacao")
        detail_query = urlencode(
            {
                "open_editor": "1",
                "rdo_id": rdo.pk,
                "os_id": getattr(os_obj, "pk", "") or "",
                "os": getattr(os_obj, "numero_os", "") or "",
                "rdo": rdo_number,
                "section": target_section,
            }
        )
        detail_url = f"{reverse('rdo')}?{detail_query}"
        origin = "Synchro AI · RDO"
    else:
        os_obj = alert.ordem_servico
        rdo_number = ""
        detail_url = ""
        origin = "Synchro AI · Operação"

    os_number = getattr(os_obj, "numero_os", None) if os_obj else None
    client = _safe_name(getattr(os_obj, "Cliente", None)) if os_obj else ""
    unit = _safe_name(getattr(os_obj, "Unidade", None)) if os_obj else ""
    recommendation = getattr(alert, "acao_recomendada", None) or ""
    explanation = getattr(alert, "explicacao_curta", None) or ""
    title = alert.identificacao_operacional
    created_local = ai_localtime(alert.criado_em)
    corrected_at = getattr(alert, "corrigido_em", None)
    corrected_local = ai_localtime(corrected_at) if corrected_at else None
    is_corrected = bool(
        alert.status == "resolvido"
        and getattr(alert, "motivo_encerramento", "") == "correcao_confirmada"
    )
    sort_at = getattr(alert, "notification_sort_at", None) or corrected_at or alert.criado_em
    os_filter_url = ""
    if os_obj and os_number:
        os_filter_url = f"{reverse('rdo')}?{urlencode({'os': os_number})}"

    return {
        "key": f"{source}:{alert.pk}",
        "source": source,
        "id": alert.pk,
        "title": title,
        "message": getattr(alert, "descricao_clara", None) or alert.mensagem,
        "summary": explanation or alert.mensagem,
        "recommendation": recommendation,
        "priority": alert.prioridade,
        "priority_label": alert.get_prioridade_display(),
        "type": alert.tipo,
        "type_label": alert.get_tipo_display(),
        "is_read": bool(is_read),
        "is_corrected": is_corrected,
        "lifecycle_status": "corrigida" if is_corrected else "pendente",
        "lifecycle_label": "Corrigida" if is_corrected else "Pendente",
        "created_at": alert.criado_em.isoformat(),
        "sort_at": sort_at.isoformat(),
        "created_date": created_local.strftime("%d/%m/%Y"),
        "created_time": created_local.strftime("%H:%M"),
        "corrected_at": corrected_at.isoformat() if corrected_at else "",
        "corrected_date": corrected_local.strftime("%d/%m/%Y") if corrected_local else "",
        "corrected_time": corrected_local.strftime("%H:%M") if corrected_local else "",
        "corrected_by": _user_display_name(getattr(alert, "corrigido_por", None)),
        "correction_origin": getattr(alert, "get_origem_correcao_display", lambda: "")(),
        "resolution_reason": getattr(alert, "get_motivo_encerramento_display", lambda: "")(),
        "resolution_time": _format_elapsed(alert.criado_em, corrected_at),
        "occurrence_count": getattr(alert, "quantidade_ocorrencias", 1) or 1,
        "corrected_without_prior_read": bool(
            is_corrected and not getattr(alert, "was_read_before_correction", False)
        ),
        "os_number": os_number or "",
        "rdo_number": rdo_number or "",
        "client": client,
        "unit": unit,
        "origin": origin,
        "target_section": target_section,
        "detail_url": detail_url,
        "os_url": os_filter_url,
        "alerts": [],
        "alert_count": 1,
        "pending_count": 0 if is_corrected else 1,
        "corrected_count": 1 if is_corrected else 0,
    }


def serialize_rdo_group(alerts, *, mode="all"):
    alerts = list(alerts or [])
    if not alerts:
        return None
    children = [
        serialize_alert("rdo", alert, bool(getattr(alert, "user_has_read", False)))
        for alert in alerts
    ]
    children.sort(key=lambda item: (item["sort_at"], item["id"]), reverse=True)
    first = children[0]
    pending = [item for item in children if not item["is_corrected"]]
    corrected = [item for item in children if item["is_corrected"]]
    considered_for_read = pending if pending else children
    is_read = bool(considered_for_read) and all(item["is_read"] for item in considered_for_read)
    priority_item = min(
        children,
        key=lambda item: PRIORITY_ORDER.get(item["priority"], 9),
    )
    unique_types = []
    for item in children:
        if item["type_label"] not in unique_types:
            unique_types.append(item["type_label"])
    preview = ", ".join(unique_types[:3])
    if len(unique_types) > 3:
        preview += f" e mais {len(unique_types) - 3}"

    if pending and corrected:
        lifecycle_label = f"{len(pending)} pendente(s) · {len(corrected)} corrigido(s)"
    elif corrected:
        lifecycle_label = "Corrigida" if len(corrected) == 1 else "Corrigidas"
    else:
        lifecycle_label = "Pendente" if len(pending) == 1 else "Pendentes"

    corrected_names = []
    for item in corrected:
        if item["corrected_by"] and item["corrected_by"] not in corrected_names:
            corrected_names.append(item["corrected_by"])
    corrected_by = corrected_names[0] if len(corrected_names) == 1 else (
        f"{len(corrected_names)} usuários" if corrected_names else ""
    )
    corrected_dates = [item for item in corrected if item["corrected_at"]]
    last_corrected = max(corrected_dates, key=lambda item: item["corrected_at"]) if corrected_dates else None
    source = RDO_GROUP_SOURCE_BY_MODE.get(mode, RDO_GROUP_SOURCE_BY_MODE["all"])

    grouped = dict(first)
    grouped.update({
        "key": f"{source}:{alerts[0].rdo_id}",
        "source": source,
        "id": alerts[0].rdo_id,
        "message": f"Este RDO possui {len(children)} ponto(s) identificado(s) pela IA.",
        "summary": f"{len(children)} ponto(s): {preview}",
        "recommendation": "Revise os pontos consolidados abaixo. Cada validação continuará sendo acompanhada separadamente pela IA.",
        "priority": priority_item["priority"],
        "priority_label": priority_item["priority_label"],
        "type": "RDO_CONSOLIDADO" if len(children) > 1 else first["type"],
        "type_label": "Alertas consolidados do RDO" if len(children) > 1 else first["type_label"],
        "is_read": is_read,
        "is_corrected": bool(corrected and not pending),
        "lifecycle_status": "corrigida" if corrected and not pending else "pendente",
        "lifecycle_label": lifecycle_label,
        "sort_at": max(item["sort_at"] for item in children),
        "corrected_at": last_corrected["corrected_at"] if last_corrected else "",
        "corrected_date": last_corrected["corrected_date"] if last_corrected else "",
        "corrected_time": last_corrected["corrected_time"] if last_corrected else "",
        "corrected_by": corrected_by,
        "correction_origin": "Várias correções" if len(corrected) > 1 else (corrected[0]["correction_origin"] if corrected else ""),
        "resolution_time": "",
        "occurrence_count": sum(item["occurrence_count"] for item in children),
        "corrected_without_prior_read": bool(corrected) and all(
            item["corrected_without_prior_read"] for item in corrected
        ),
        "alerts": children,
        "alert_count": len(children),
        "pending_count": len(pending),
        "corrected_count": len(corrected),
    })
    return grouped


def _group_rdo_alerts(alerts, *, mode):
    grouped = {}
    for alert in alerts:
        grouped.setdefault(alert.rdo_id, []).append(alert)
    return [
        serialize_rdo_group(items, mode=mode)
        for items in grouped.values()
    ]


def all_accessible_serialized(user):
    rdo_qs, operational_qs = accessible_alert_querysets(user)
    rdo_alerts = list(rdo_qs)
    operational_alerts = list(operational_qs)
    read_keys = _read_keys(
        user,
        [item.pk for item in rdo_alerts],
        [item.pk for item in operational_alerts],
    )
    items = [
        serialize_alert("rdo", item, ("rdo", item.pk) in read_keys)
        for item in rdo_alerts
    ] + [
        serialize_alert("operacional", item, ("operacional", item.pk) in read_keys)
        for item in operational_alerts
    ]
    return sorted(items, key=lambda item: (item["created_at"], item["id"]), reverse=True)


def notification_snapshot(user, limit=5):
    # The compact header dropdown remains a lightweight daily preview.
    rdo_qs, operational_qs = accessible_alert_querysets(user, daily_only=True)
    rdo_qs = _with_read_state(rdo_qs, user, "rdo")
    operational_qs = _with_read_state(operational_qs, user, "operacional")
    rdo_groups = _group_rdo_alerts(list(rdo_qs), mode="active")
    unread = [item for item in rdo_groups if not item["is_read"]]
    read = [item for item in rdo_groups if item["is_read"]]
    operational_items = _serialize_annotated("operacional", list(operational_qs))
    unread += [item for item in operational_items if not item["is_read"]]
    read += [item for item in operational_items if item["is_read"]]
    unread_count = len(unread)
    unread.sort(key=lambda item: (item["sort_at"], item["id"]), reverse=True)
    read.sort(key=lambda item: (item["sort_at"], item["id"]), reverse=True)
    ordered = unread + read
    return {
        "unread_count": unread_count,
        "items": ordered[:limit],
        "total": len(rdo_groups) + len(operational_items),
    }


def filtered_page(
    user,
    *,
    tab="pendentes",
    query="",
    priority="",
    alert_type="",
    page=1,
    page_size=PAGE_SIZE_DEFAULT,
):
    query = (query or "").strip()
    priority = (priority or "").strip().lower()
    alert_type = (alert_type or "").strip().upper()
    rdo_qs, operational_qs = accessible_alert_querysets(user, include_corrected=True)
    rdo_qs = _with_read_state(rdo_qs, user, "rdo")
    operational_qs = _with_read_state(operational_qs, user, "operacional")
    rdo_qs = _apply_database_filters(rdo_qs, "rdo", query, priority, alert_type)
    operational_qs = _apply_database_filters(
        operational_qs,
        "operacional",
        query,
        priority,
        alert_type,
    )
    corrected_metrics = _corrected_metrics(rdo_qs, operational_qs)

    rdo_all_groups = _group_rdo_alerts(list(rdo_qs), mode="all")
    rdo_active_groups = _group_rdo_alerts(
        list(rdo_qs.filter(status="pendente")),
        mode="active",
    )
    rdo_corrected_groups = _group_rdo_alerts(
        list(rdo_qs.filter(status="resolvido", motivo_encerramento="correcao_confirmada")),
        mode="corrected",
    )
    rdo_pending_groups = [item for item in rdo_active_groups if not item["is_read"]]
    rdo_read_groups = [item for item in rdo_active_groups if item["is_read"]]

    operational_all = _serialize_annotated("operacional", list(operational_qs))
    operational_pending = [
        item for item in operational_all if not item["is_corrected"] and not item["is_read"]
    ]
    operational_read = [
        item for item in operational_all if not item["is_corrected"] and item["is_read"]
    ]
    operational_corrected = [item for item in operational_all if item["is_corrected"]]

    counts = {
        "all": len(rdo_all_groups) + len(operational_all),
        "pending": len(rdo_pending_groups) + len(operational_pending),
        "read": len(rdo_read_groups) + len(operational_read),
        "corrected": len(rdo_corrected_groups) + len(operational_corrected),
    }
    global_unread = counts["pending"]

    if tab == "lidas":
        candidates = rdo_read_groups + operational_read
    elif tab == "corrigidas":
        candidates = rdo_corrected_groups + operational_corrected
    elif tab == "todas":
        candidates = rdo_all_groups + operational_all
    else:
        tab = "pendentes"
        candidates = rdo_pending_groups + operational_pending

    try:
        page = max(1, int(page))
    except (TypeError, ValueError):
        page = 1
    try:
        page_size = min(PAGE_SIZE_MAX, max(1, int(page_size)))
    except (TypeError, ValueError):
        page_size = PAGE_SIZE_DEFAULT
    candidates.sort(key=lambda item: (item["sort_at"], item["id"]), reverse=True)
    total = len(candidates)
    start = (page - 1) * page_size
    end = min(total, start + page_size)
    items = candidates[start:end]
    return {
        "items": items,
        "counts": counts,
        "corrected_metrics": corrected_metrics,
        "unread_count": global_unread,
        "tab": tab,
        "page": page,
        "page_size": page_size,
        "total": total,
        "start": 0 if not items or start >= total else start + 1,
        "end": end,
        "has_more": end < total,
        "priorities": [
            {"value": value, "label": label}
            for value, label in AlertaInteligente.PRIORIDADES
        ],
        "alert_types": [
            {"value": value, "label": label, "group": "RDO"}
            for value, label in AlertaInteligente.TIPOS
        ] + [
            {"value": value, "label": label, "group": "Operação"}
            for value, label in AlertaOperacionalInteligente.TIPOS
        ],
    }


def get_accessible_alert(user, source, alert_id):
    rdo_qs, operational_qs = accessible_alert_querysets(user, include_corrected=True)
    group_mode = RDO_GROUP_MODE_BY_SOURCE.get(source)
    if group_mode:
        alerts = _with_read_state(
            rdo_qs.filter(rdo_id=alert_id),
            user,
            "rdo",
        )
        if group_mode == "active":
            alerts = alerts.filter(status="pendente")
        elif group_mode == "corrected":
            alerts = alerts.filter(
                status="resolvido",
                motivo_encerramento="correcao_confirmada",
            )
        alerts = list(alerts)
        if not alerts:
            return None
        return alerts, all(bool(alert.user_has_read) for alert in alerts)
    if source == "rdo":
        alert = rdo_qs.filter(pk=alert_id).first()
    elif source == "operacional":
        alert = operational_qs.filter(pk=alert_id).first()
    else:
        alert = None
    if not alert:
        return None
    read_keys = _read_keys(
        user,
        [alert.pk] if source == "rdo" else [],
        [alert.pk] if source == "operacional" else [],
    )
    return alert, (source, alert.pk) in read_keys


def set_read_state(user, source, alert, is_read):
    if source in RDO_GROUP_MODE_BY_SOURCE:
        receipts = []
        for child_alert in alert:
            receipt, _ = LeituraAlertaIA.objects.update_or_create(
                usuario=user,
                alerta_rdo=child_alert,
                defaults={
                    "lido": bool(is_read),
                    "lido_em": timezone.now() if is_read else None,
                },
            )
            receipts.append(receipt)
        return receipts
    lookup = {
        "usuario": user,
        "alerta_rdo": alert if source == "rdo" else None,
        "alerta_operacional": alert if source == "operacional" else None,
    }
    receipt, _ = LeituraAlertaIA.objects.update_or_create(
        **lookup,
        defaults={
            "lido": bool(is_read),
            "lido_em": timezone.now() if is_read else None,
        },
    )
    return receipt


@transaction.atomic
def mark_all_read(user):
    rdo_qs, operational_qs = accessible_alert_querysets(user)
    rdo_ids = list(rdo_qs.values_list("id", flat=True))
    operational_ids = list(operational_qs.values_list("id", flat=True))
    now = timezone.now()
    existing_rdo = set(
        LeituraAlertaIA.objects.filter(usuario=user, alerta_rdo_id__in=rdo_ids)
        .values_list("alerta_rdo_id", flat=True)
    )
    existing_operational = set(
        LeituraAlertaIA.objects.filter(usuario=user, alerta_operacional_id__in=operational_ids)
        .values_list("alerta_operacional_id", flat=True)
    )
    unread_existing_count = LeituraAlertaIA.objects.filter(
        usuario=user,
        lido=False,
    ).filter(
        Q(alerta_rdo_id__in=rdo_ids)
        | Q(alerta_operacional_id__in=operational_ids)
    ).count()
    LeituraAlertaIA.objects.filter(
        usuario=user,
        alerta_rdo_id__in=rdo_ids,
    ).update(lido=True, lido_em=now, atualizado_em=now)
    LeituraAlertaIA.objects.filter(
        usuario=user,
        alerta_operacional_id__in=operational_ids,
    ).update(lido=True, lido_em=now, atualizado_em=now)
    LeituraAlertaIA.objects.bulk_create(
        [
            LeituraAlertaIA(usuario=user, alerta_rdo_id=alert_id, lido=True, lido_em=now)
            for alert_id in rdo_ids if alert_id not in existing_rdo
        ] + [
            LeituraAlertaIA(usuario=user, alerta_operacional_id=alert_id, lido=True, lido_em=now)
            for alert_id in operational_ids if alert_id not in existing_operational
        ],
        ignore_conflicts=True,
    )
    return (
        unread_existing_count
        + len([alert_id for alert_id in rdo_ids if alert_id not in existing_rdo])
        + len([alert_id for alert_id in operational_ids if alert_id not in existing_operational])
    )

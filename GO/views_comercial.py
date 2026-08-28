import json
import base64
import hashlib
import os
import re
import unicodedata
from functools import wraps
from io import BytesIO
import logging
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation

from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.core.serializers.json import DjangoJSONEncoder
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.db.models import Max
from django.core.paginator import Paginator
from django.http import FileResponse, HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_GET, require_POST

from .models import AnaliseCriticaOportunidade, AnexoPropostaComercial, Cliente, Financeiro, FinanceiroCampo, ItemEquipamentoComercial, MetodoOperacional, OrdemServico, PropostaDocumentoFinanceiroSnapshot, PropostaDocumentoImagem, PropostaDocumentoLinha, PropostaDocumentoRevisao, ResponsavelCoordenador, RdoTanque, SegmentoClienteComercial, ServicoComercial, Unidade
from .proposal_official_pdf import OfficialProposalPdfError, generate_official_proposal_pdf, load_offshore_template_draft
from .rdo_access import user_can_manage_rdo_permission_users, user_can_manage_responsaveis_coordenadores


logger = logging.getLogger(__name__)


def commercial_preview_required(view_func):
    """Compatibility decorator retained after the public launch of Propostas."""
    @wraps(view_func)
    def wrapped(request, *args, **kwargs):
        return view_func(request, *args, **kwargs)

    return wrapped


KANBAN_STAGES = [
    {
        "key": "avaliacao_inicial",
        "label": "Avaliação Inicial",
        "description": "Sem retorno, em análise, avaliando escopo",
    },
    {
        "key": "preparacao_aprovacao",
        "label": "Preparação e Aprovação",
        "description": "Em elaboração, aguardando aprovação",
    },
    {
        "key": "propostas_enviadas",
        "label": "Propostas Enviadas",
        "description": "Revisada, shortlist",
    },
    {
        "key": "negociacao",
        "label": "Negociação",
        "description": "Em negociação",
    },
    {
        "key": "contratadas",
        "label": "Contratadas",
        "description": "Fechadas / Contratadas",
    },
    {
        "key": "canceladas",
        "label": "Canceladas",
        "description": "Propostas canceladas",
    },
]

KANBAN_STAGE_KEYS = [stage["key"] for stage in KANBAN_STAGES]

FINAL_STATUS_KEYS = {"fechada/contratada", "contratada", "perdida/recusada", "cancelada", "declinio"}

COMMERCIAL_NATURE_OPTIONS = [
    "Aditivo",
    "Reajuste",
    "Spot",
    "Contrato Novo",
    "Renovação",
]

FOLLOWUP_STATUSES = ["Pendente", "Realizado", "Sem retorno", "Reagendado"]

# This mapping is intentionally visual only. The real proposal status remains in
# Financeiro.status_proposta and is never overwritten by a pipeline phase.
KANBAN_STAGE_MAP = {
    "sem retorno": "avaliacao_inicial",
    "em analise": "avaliacao_inicial",
    "avaliando escopo": "avaliacao_inicial",
    "em elaboracao": "preparacao_aprovacao",
    "aguardando aprovacao gestores": "preparacao_aprovacao",
    "revisada": "propostas_enviadas",
    "shortlist": "propostas_enviadas",
    "enviada": "propostas_enviadas",
    "em negociacao": "negociacao",
    "fechada/contratada": "contratadas",
    "contratada": "contratadas",
    "cancelada": "canceladas",
}

STATUS_DISPLAY_MAP = {
    "em analise": "Em Análise",
    "avaliando escopo": "Avaliando escopo",
    "em elaboracao": "Em Elaboração",
    "aguardando aprovacao gestores": "Aguardando aprovação gestores",
    "revisada": "Revisada",
    "shortlist": "ShortList",
    "enviada": "Enviada",
    "em negociacao": "Em Negociação",
    "fechada/contratada": "Fechada/Contratada",
    "perdida/recusada": "Perdida/Recusada",
    "cancelada": "Cancelada",
    "declinio": "Declínio",
    "sem retorno": "Sem Retorno",
}

STATUS_RESUMO_MAP = {
    "em analise": "em_analise",
    "avaliando escopo": "em_analise",
    "em elaboracao": "em_elaboracao",
    "aguardando aprovacao gestores": "em_analise",
    "aguardando aprovação gestores": "em_analise",
    "revisada": "em_analise",
    "shortlist": "em_analise",
    "enviada": "em_analise",
    "em negociacao": "em_analise",
    "em negociação": "em_analise",
    "fechada/contratada": "fechada_contratada",
    "fechada / contratada": "fechada_contratada",
    "perdida/recusada": "perdida_recusada",
    "perdida / recusada": "perdida_recusada",
    "cancelada": "perdida_recusada",
    "declinio": "perdida_recusada",
    "declínio": "perdida_recusada",
}

RESUMO_MONTH_NAMES = {
    1: "Janeiro",
    2: "Fevereiro",
    3: "Março",
    4: "Abril",
    5: "Maio",
    6: "Junho",
    7: "Julho",
    8: "Agosto",
    9: "Setembro",
    10: "Outubro",
    11: "Novembro",
    12: "Dezembro",
}


def _normalize_key(value):
    normalized = unicodedata.normalize("NFD", str(value or "").strip())
    normalized = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
    return normalized.lower()


def _clean_text(value):
    return str(value or "").strip()


def _format_date_br(value):
    if not value:
        return ""
    return value.strftime("%d/%m/%Y")


def _format_currency_br(value):
    amount = value if isinstance(value, Decimal) else Decimal(str(value or 0))
    text = f"{amount:,.2f}"
    return f"R$ {text.replace(',', 'X').replace('.', ',').replace('X', '.')}"


def _format_millions_br(value):
    amount = Decimal(value or 0) / Decimal("1000000")
    text = f"{amount:.2f}".replace(".", ",")
    return f"R$ {text} mi"


def _format_stage_revenue_br(value):
    amount = _safe_decimal(value)
    if amount >= Decimal("1000000"):
        return _format_millions_br(amount)
    return _format_currency_br(amount)


def _format_decimal_string(value):
    amount = _safe_decimal(value)
    return f"{amount:.2f}"


def _get_next_proposal_number(lock=False):
    queryset = Financeiro.objects
    if lock:
        queryset = queryset.select_for_update()
    last_item = queryset.order_by("-proposta").first()
    if last_item:
        return max(4000, last_item.proposta + 1)
    return 4000


def _safe_decimal(value, default="0"):
    if value in (None, ""):
        return Decimal(default)
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal(default)


def _parse_decimal_input(value):
    if value in (None, ""):
        return Decimal("0")
    text = str(value).strip().replace("R$", "").replace(" ", "")
    # Accept both the visual Brazilian format (1.600,00) and the decimal
    # format sent by the JavaScript payload (1600.00).
    if "," in text:
        text = text.replace(".", "").replace(",", ".")
    elif text.count(".") > 1:
        text = text.replace(".", "")
    try:
        return Decimal(text)
    except (InvalidOperation, TypeError, ValueError):
        return Decimal("0")


def _parse_date_input(value):
    if not value:
        return None
    text = str(value).strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def _resolve_followup_summary_and_date(raw_value):
    text = _clean_text(raw_value)
    if not text:
        return "", None
    parsed_date = _parse_date_input(text)
    if parsed_date:
        return "", parsed_date
    return text, None


def _parse_bool_input(value):
    text = _normalize_key(value)
    return text in {"sim", "true", "1", "yes"}


def _parse_proposal_number(value):
    digits = re.sub(r"\D", "", str(value or ""))
    if not digits:
        return None
    return int(digits)


def _format_proposal_number(value):
    digits = re.sub(r"\D", "", str(value or ""))
    if not digits:
        return ""
    if len(digits) >= 7:
        return f"PRO-{digits[:4]}-{digits[4:]}"
    return f"PRO-{digits}"


def _display_status(raw_status):
    normalized = _normalize_key(raw_status)
    return STATUS_DISPLAY_MAP.get(normalized, _clean_text(raw_status))


def get_kanban_stage(raw_status):
    """Return a visual stage for a known real status, or None when unmapped."""
    return KANBAN_STAGE_MAP.get(_normalize_key(raw_status))


def _resumo_status_bucket(raw_status):
    return STATUS_RESUMO_MAP.get(_normalize_key(raw_status), "em_analise")


def _resolve_tipo_operacao_label(financeiro):
    related = getattr(financeiro, "tipo_operacao", None)
    if related is None:
        return ""
    return _clean_text(getattr(related, "tipo_operacao", ""))


def _resolve_resumo_period(mes_value, ano_value, modo_value):
    today = timezone.localdate()
    requested_month = _clean_text(mes_value)
    requested_year = _clean_text(ano_value)

    # On first access, show the most recent month that actually has proposal
    # emissions instead of an empty current calendar month.
    latest_emission_query = Financeiro.objects.exclude(data_emissao__isnull=True)
    if requested_year:
        try:
            latest_emission_query = latest_emission_query.filter(data_emissao__year=int(requested_year))
        except (TypeError, ValueError):
            pass
    latest_emission = latest_emission_query.order_by("-data_emissao").values_list("data_emissao", flat=True).first()
    default_date = latest_emission or today

    try:
        mes = max(1, min(12, int(str(requested_month or default_date.month))))
    except (TypeError, ValueError):
        mes = default_date.month

    try:
        ano = int(str(requested_year or default_date.year))
    except (TypeError, ValueError):
        ano = default_date.year

    modo = "acumulado" if _clean_text(modo_value).lower() == "acumulado" else "mensal"

    start_month = date(ano, mes, 1)
    next_month = date(ano + 1, 1, 1) if mes == 12 else date(ano, mes + 1, 1)
    end_month = next_month - timedelta(days=1)

    if modo == "acumulado":
        period_start = date(ano, 1, 1)
        period_end = end_month
    else:
        period_start = start_month
        period_end = end_month

    return {
        "mes": f"{mes:02d}",
        "mes_numero": mes,
        "ano": str(ano),
        "ano_numero": ano,
        "modo": modo,
        "period_start": period_start,
        "period_end": period_end,
        "year_start": date(ano, 1, 1),
        "year_end": end_month,
    }


def _serialize_resumo_table_money(value):
    amount = _safe_decimal(value)
    return float(amount)


def _build_resumo_propostas_context():
    period = _resolve_resumo_period(None, None, None)
    return build_resumo_propostas_context(
        mes=period["mes"],
        ano=period["ano"],
        modo=period["modo"],
    )


def build_resumo_propostas_context(mes=None, ano=None, modo=None):
    period = _resolve_resumo_period(mes, ano, modo)
    base_queryset = (
        Financeiro.objects.select_related("tipo_operacao")
        .exclude(data_emissao__isnull=True)
        .order_by("-data_emissao", "-proposta")
    )

    period_queryset = base_queryset.filter(
        data_emissao__gte=period["period_start"],
        data_emissao__lte=period["period_end"],
    )
    year_queryset = base_queryset.filter(
        data_emissao__gte=period["year_start"],
        data_emissao__lte=period["year_end"],
    )

    rows = list(period_queryset)
    year_rows = list(year_queryset)

    segmento_template = {
        "Offshore": {
            "segmento": "Offshore",
            "emAnalise": Decimal("0"),
            "emElaboracao": Decimal("0"),
            "fechadaContratada": Decimal("0"),
            "perdidaRecusada": Decimal("0"),
            "total": Decimal("0"),
        },
        "Onshore": {
            "segmento": "Onshore",
            "emAnalise": Decimal("0"),
            "emElaboracao": Decimal("0"),
            "fechadaContratada": Decimal("0"),
            "perdidaRecusada": Decimal("0"),
            "total": Decimal("0"),
        },
    }

    status_money = {
        "em_analise": Decimal("0"),
        "em_elaboracao": Decimal("0"),
        "fechada_contratada": Decimal("0"),
        "perdida_recusada": Decimal("0"),
    }
    receita_status_money = {
        "em_analise": Decimal("0"),
        "em_elaboracao": Decimal("0"),
        "fechada_contratada": Decimal("0"),
        "perdida_recusada": Decimal("0"),
        "canceladas": Decimal("0"),
    }
    status_quantity = {
        "em_analise": 0,
        "em_elaboracao": 0,
        "fechada_contratada": 0,
        "perdida_recusada": 0,
    }
    gestores_reais_map = {}
    gestores_quantidade_map = {}

    total_emitido_periodo = Decimal("0")

    for item in rows:
        valor = _safe_decimal(getattr(item, "estimativo_receita", None))
        bucket = _resumo_status_bucket(getattr(item, "status_proposta", ""))
        total_emitido_periodo += valor
        status_money[bucket] += valor
        status_quantity[bucket] += 1
        if _normalize_key(getattr(item, "status_proposta", "")) == "cancelada":
            receita_status_money["canceladas"] += valor
        else:
            receita_status_money[bucket] += valor

        tipo_operacao = _normalize_key(_get_proposal_operation(item))
        if tipo_operacao == "offshore":
            segment_row = segmento_template["Offshore"]
            segment_row["emAnalise" if bucket == "em_analise" else "emElaboracao" if bucket == "em_elaboracao" else "fechadaContratada" if bucket == "fechada_contratada" else "perdidaRecusada"] += valor
            segment_row["total"] += valor
        elif tipo_operacao == "onshore":
            segment_row = segmento_template["Onshore"]
            segment_row["emAnalise" if bucket == "em_analise" else "emElaboracao" if bucket == "em_elaboracao" else "fechadaContratada" if bucket == "fechada_contratada" else "perdidaRecusada"] += valor
            segment_row["total"] += valor

        gestor = _clean_text(getattr(item, "responsavel", "")) or "Não informado"
        if gestor not in gestores_reais_map:
            gestores_reais_map[gestor] = {
                "gestor": gestor,
                "emAnalise": Decimal("0"),
                "emElaboracao": Decimal("0"),
                "fechadaContratada": Decimal("0"),
                "perdidaRecusada": Decimal("0"),
                "total": Decimal("0"),
            }
        if gestor not in gestores_quantidade_map:
            gestores_quantidade_map[gestor] = {
                "gestor": gestor,
                "emAnalise": 0,
                "emElaboracao": 0,
                "fechadaContratada": 0,
                "perdidaRecusada": 0,
                "total": 0,
            }

        gestor_row = gestores_reais_map[gestor]
        if bucket == "em_analise":
            gestor_row["emAnalise"] += valor
        elif bucket == "em_elaboracao":
            gestor_row["emElaboracao"] += valor
        elif bucket == "fechada_contratada":
            gestor_row["fechadaContratada"] += valor
        else:
            gestor_row["perdidaRecusada"] += valor
        gestor_row["total"] += valor

        gestor_quantidade_row = gestores_quantidade_map[gestor]
        if bucket == "em_analise":
            gestor_quantidade_row["emAnalise"] += 1
        elif bucket == "em_elaboracao":
            gestor_quantidade_row["emElaboracao"] += 1
        elif bucket == "fechada_contratada":
            gestor_quantidade_row["fechadaContratada"] += 1
        else:
            gestor_quantidade_row["perdidaRecusada"] += 1
        gestor_quantidade_row["total"] += 1

    total_acumulado_ano = sum((_safe_decimal(getattr(item, "estimativo_receita", None)) for item in year_rows), Decimal("0"))
    total_propostas_periodo = len(rows)

    segmentos = [
        {
            "segmento": "Offshore",
            "emAnalise": _serialize_resumo_table_money(segmento_template["Offshore"]["emAnalise"]),
            "emElaboracao": _serialize_resumo_table_money(segmento_template["Offshore"]["emElaboracao"]),
            "fechadaContratada": _serialize_resumo_table_money(segmento_template["Offshore"]["fechadaContratada"]),
            "perdidaRecusada": _serialize_resumo_table_money(segmento_template["Offshore"]["perdidaRecusada"]),
            "total": _serialize_resumo_table_money(segmento_template["Offshore"]["total"]),
        },
        {
            "segmento": "Onshore",
            "emAnalise": _serialize_resumo_table_money(segmento_template["Onshore"]["emAnalise"]),
            "emElaboracao": _serialize_resumo_table_money(segmento_template["Onshore"]["emElaboracao"]),
            "fechadaContratada": _serialize_resumo_table_money(segmento_template["Onshore"]["fechadaContratada"]),
            "perdidaRecusada": _serialize_resumo_table_money(segmento_template["Onshore"]["perdidaRecusada"]),
            "total": _serialize_resumo_table_money(segmento_template["Onshore"]["total"]),
        },
    ]
    segmentos.append(
        {
            "segmento": "Total",
            "emAnalise": _serialize_resumo_table_money(status_money["em_analise"]),
            "emElaboracao": _serialize_resumo_table_money(status_money["em_elaboracao"]),
            "fechadaContratada": _serialize_resumo_table_money(status_money["fechada_contratada"]),
            "perdidaRecusada": _serialize_resumo_table_money(status_money["perdida_recusada"]),
            "total": _serialize_resumo_table_money(total_emitido_periodo),
        }
    )

    receita_status = []
    for key, label, tone in (
        ("em_analise", "Em Análise", "is-analysis"),
        ("em_elaboracao", "Em Elaboração", "is-elaboration"),
        ("fechada_contratada", "Fechada / Contratada", "is-closed"),
        ("perdida_recusada", "Perdida / Recusada", "is-lost"),
        ("canceladas", "Canceladas", "is-cancelled"),
    ):
        valor = receita_status_money[key]
        percentual = (valor / total_emitido_periodo * Decimal("100")) if total_emitido_periodo > 0 else Decimal("0")
        receita_status.append(
            {
                "status": label,
                "valor": _serialize_resumo_table_money(valor),
                "percentual": float(percentual),
                "tone": tone,
            }
        )
    receita_status.append(
        {
            "status": "Total",
            "valor": _serialize_resumo_table_money(total_emitido_periodo),
            "percentual": 100.0 if total_emitido_periodo > 0 else 0.0,
            "tone": "is-total",
        }
    )

    gestores_reais = sorted(
        (
            {
                "gestor": row["gestor"],
                "emAnalise": _serialize_resumo_table_money(row["emAnalise"]),
                "emElaboracao": _serialize_resumo_table_money(row["emElaboracao"]),
                "fechadaContratada": _serialize_resumo_table_money(row["fechadaContratada"]),
                "perdidaRecusada": _serialize_resumo_table_money(row["perdidaRecusada"]),
                "total": _serialize_resumo_table_money(row["total"]),
            }
            for row in gestores_reais_map.values()
        ),
        key=lambda item: item["total"],
        reverse=True,
    )

    distribuicao_status = []
    for key, label, tone in (
        ("em_analise", "Em Análise", "is-analysis"),
        ("em_elaboracao", "Em Elaboração", "is-elaboration"),
        ("fechada_contratada", "Fechada / Contratada", "is-closed"),
        ("perdida_recusada", "Perdida / Recusada", "is-lost"),
    ):
        quantidade = status_quantity[key]
        percentual = (Decimal(quantidade) / Decimal(total_propostas_periodo) * Decimal("100")) if total_propostas_periodo else Decimal("0")
        distribuicao_status.append(
            {
                "status": label,
                "quantidade": quantidade,
                "percentual": float(percentual),
                "tone": tone,
            }
        )

    gestores_quantidade = sorted(
        (
            {
                "gestor": row["gestor"],
                "emAnalise": row["emAnalise"],
                "emElaboracao": row["emElaboracao"],
                "fechadaContratada": row["fechadaContratada"],
                "perdidaRecusada": row["perdidaRecusada"],
                "total": row["total"],
            }
            for row in gestores_quantidade_map.values()
        ),
        key=lambda item: item["total"],
        reverse=True,
    )
    if gestores_quantidade:
        gestores_quantidade.append(
            {
                "gestor": "Total",
                "emAnalise": status_quantity["em_analise"],
                "emElaboracao": status_quantity["em_elaboracao"],
                "fechadaContratada": status_quantity["fechada_contratada"],
                "perdidaRecusada": status_quantity["perdida_recusada"],
                "total": total_propostas_periodo,
            }
        )

    month_name = RESUMO_MONTH_NAMES.get(period["mes_numero"], period["mes"])
    periodo_label = (
        f"Visão acumulada - Jan/{period['ano']}"
        if period["modo"] == "acumulado"
        else f"Visão mensal - {month_name}/{period['ano']}"
    )

    month_options = [{"value": f"{month:02d}", "label": f"{month:02d}"} for month in range(1, 13)]
    years_found = sorted(
        {
            item.year
            for item in Financeiro.objects.exclude(data_emissao__isnull=True)
            .dates("data_emissao", "year")
        }
    )
    if not years_found:
        current_year = timezone.localdate().year
        years_found = [current_year]

    bootstrap = {
        "filters": {
            "mes": period["mes"],
            "ano": period["ano"],
            "modo": period["modo"],
            "monthOptions": month_options,
            "yearOptions": [str(year) for year in years_found],
        },
        "data": {
            "indicadores": {
                "totalEmitidoPeriodo": float(total_emitido_periodo),
                "emAnalise": {"valor": float(status_money["em_analise"]), "percentual": float((status_money["em_analise"] / total_emitido_periodo * Decimal("100")) if total_emitido_periodo else Decimal("0"))},
                "emElaboracao": {"valor": float(status_money["em_elaboracao"]), "percentual": float((status_money["em_elaboracao"] / total_emitido_periodo * Decimal("100")) if total_emitido_periodo else Decimal("0"))},
                "fechadaContratada": {"valor": float(status_money["fechada_contratada"]), "percentual": float((status_money["fechada_contratada"] / total_emitido_periodo * Decimal("100")) if total_emitido_periodo else Decimal("0"))},
                "perdidaRecusada": {"valor": float(status_money["perdida_recusada"]), "percentual": float((status_money["perdida_recusada"] / total_emitido_periodo * Decimal("100")) if total_emitido_periodo else Decimal("0"))},
                "qtdPropostasPeriodo": total_propostas_periodo,
                "totalAcumuladoAno": float(total_acumulado_ano),
            },
            "porSegmentoReais": segmentos,
            "receitaPorStatus": receita_status,
            "porGestorReais": gestores_reais,
            "distribuicaoStatusQuantidade": distribuicao_status,
            "porGestorQuantidade": gestores_quantidade,
            "periodoLabel": periodo_label,
            "emptyMessage": "Nenhuma proposta encontrada para o período selecionado.",
        },
    }

    return {
        "resumo_bootstrap": bootstrap,
        "resumo_mes": period["mes"],
        "resumo_ano": period["ano"],
        "resumo_modo": period["modo"],
        "resumo_month_options": month_options,
        "resumo_year_options": [str(year) for year in years_found],
    }


@login_required(login_url="/login/")
@commercial_preview_required
@require_GET
def comercial_resumo_propostas(request):
    context = build_resumo_propostas_context(
        mes=request.GET.get("mes"),
        ano=request.GET.get("ano"),
        modo=request.GET.get("modo"),
    )
    return render(request, "comercial/resumo_propostas.html", context)


def _resolve_cliente_name(ordem_servico):
    if not ordem_servico:
        return ""
    try:
        if getattr(ordem_servico, "Cliente", None):
            return ordem_servico.Cliente.nome
    except Exception:
        pass
    return _clean_text(getattr(ordem_servico, "cliente", ""))


def _resolve_unidade_name(ordem_servico):
    if not ordem_servico:
        return ""
    try:
        if getattr(ordem_servico, "Unidade", None):
            return ordem_servico.Unidade.nome
    except Exception:
        pass
    return _clean_text(getattr(ordem_servico, "unidade", ""))


def _resolve_os_string(ordem_servico, field_name, fallback=""):
    if not ordem_servico:
        return fallback
    value = getattr(ordem_servico, field_name, "")
    return _clean_text(value or fallback)


def _resolve_tipo_operacao(financeiro):
    return _resolve_os_string(financeiro.tipo_operacao, "tipo_operacao", "")


def _serialize_financeiro_campos(financeiro):
    items = []
    total = Decimal("0")
    for campo in financeiro.campos.all():
        subtotal = _safe_decimal(campo.subtotal)
        total += subtotal
        items.append(
            {
                "id": campo.id,
                "nome": campo.nome,
                "label": campo.get_nome_display(),
                "preco_unitario": _format_decimal_string(campo.preco_unitario),
                "quantidade": _format_decimal_string(campo.quantidade),
                "subtotal": _format_decimal_string(subtotal),
            }
        )
    return items, total


def _serialize_proposta_anexo(anexo):
    return {
        "id": anexo.id,
        "nome": anexo.nome_original,
        "tamanho": anexo.arquivo.size if anexo.arquivo else 0,
        "criadoEm": timezone.localtime(anexo.criado_em).strftime("%d/%m/%Y %H:%M") if anexo.criado_em else "",
        "enviadoPor": _clean_text(getattr(anexo.enviado_por, "get_full_name", lambda: "")()) or _clean_text(getattr(anexo.enviado_por, "username", "")),
        "visualizarUrl": reverse("comercial_visualizar_anexo_proposta", args=[anexo.id]),
        "excluirUrl": reverse("comercial_excluir_anexo_proposta", args=[anexo.id]),
    }


CRITICAL_ANALYSIS_FIELDS = AnaliseCriticaOportunidade.RESPONSE_FIELDS
CRITICAL_ANALYSIS_VALID_RESPONSES = {value for value, _label in AnaliseCriticaOportunidade.RESPOSTAS}
CRITICAL_ANALYSIS_QUESTIONS = {
    "capacidade_atender_requisitos": "Nossa empresa possui capacidade para atender integralmente aos requisitos do cliente?",
    "habilitacao_tecnica_atendida": "Os requisitos de habilitação técnica exigidos para esta oportunidade são atendidos?",
    "visita_tecnica_necessaria": "É necessária visita técnica?",
    "escopo_claramente_definido": "O escopo está claramente definido?",
    "competencia_tecnica_execucao": "Possuímos competência técnica para executar?",
    "recursos_disponiveis": "Os recursos humanos, materiais e equipamentos necessários para execução do contrato estão disponíveis e atendem aos requisitos do cliente?",
    "equipe_com_treinamentos": "A equipe possui os treinamentos necessários para a atividade?",
    "equipe_irata_disponivel": "Quando aplicável, a empresa possui equipe IRATA disponível?",
    "equipe_resgate_disponivel": "Quando aplicável, a empresa possui equipe de resgate disponível?",
    "tempo_habil_mobilizacao": "Existe tempo hábil para mobilização na data solicitada pelo cliente?",
    "tempo_habil_aquisicao": "Existe tempo hábil para aquisição de materiais ou equipamentos específicos, quando aplicável?",
    "riscos_comerciais_relevantes": "O contrato apresenta riscos comerciais relevantes?",
    "oportunidade_viavel_rentavel": "A oportunidade é comercialmente viável e rentável para a empresa?",
    "pendencias_financeiras_cliente": "Existem pendências financeiras do cliente junto à Ambipar?",
    "iremos_participar": "Iremos participar?",
}


def _proposal_will_not_participate(payload):
    """Return whether the critical analysis records that the opportunity will not proceed."""
    raw_analysis = payload.get("analise_critica_oportunidade") or {}
    if not isinstance(raw_analysis, dict):
        return False
    raw_answers = raw_analysis.get("respostas", raw_analysis)
    if not isinstance(raw_answers, dict):
        return False
    return _clean_text(raw_answers.get("iremos_participar")).upper() == AnaliseCriticaOportunidade.RESPOSTA_NAO


def _serialize_critical_analysis(financeiro):
    analysis = getattr(financeiro, "analise_critica_oportunidade", None)
    answers = {
        field_name: getattr(analysis, field_name, None) if analysis else None
        for field_name in CRITICAL_ANALYSIS_FIELDS
    }
    answered_count = sum(1 for value in answers.values() if value in CRITICAL_ANALYSIS_VALID_RESPONSES)
    completed = answered_count == len(CRITICAL_ANALYSIS_FIELDS)
    return {
        "respostas": answers,
        "comentario": _clean_text(getattr(analysis, "comentario", "")),
        "quantidadeRespondida": answered_count,
        "totalPerguntas": len(CRITICAL_ANALYSIS_FIELDS),
        "realizada": completed,
        "status": "Realizada" if completed else "Pendente",
    }


def _parse_critical_analysis_payload(payload):
    if "analise_critica_oportunidade" not in payload:
        return None, {}, None

    raw_analysis = payload.get("analise_critica_oportunidade")
    if raw_analysis in (None, ""):
        raw_analysis = {}
    if not isinstance(raw_analysis, dict):
        return None, {"analise_critica_oportunidade": "Informe uma análise crítica válida."}, None

    raw_answers = raw_analysis.get("respostas", raw_analysis)
    if not isinstance(raw_answers, dict):
        return None, {"analise_critica_oportunidade": "Informe as respostas da análise crítica."}, None

    answers = {}
    errors = {}
    for field_name in CRITICAL_ANALYSIS_FIELDS:
        value = _clean_text(raw_answers.get(field_name)).upper()
        if not value:
            answers[field_name] = None
        elif value in CRITICAL_ANALYSIS_VALID_RESPONSES:
            answers[field_name] = value
        else:
            errors[f"analise_critica_oportunidade.{field_name}"] = "Resposta inválida. Use Sim, Não ou NA."

    comment = _clean_text(raw_analysis.get("comentario"))
    return answers, errors, comment


def _save_critical_analysis(financeiro, answers, comment, user):
    analysis, created = AnaliseCriticaOportunidade.objects.get_or_create(
        proposta=financeiro,
        defaults={"criado_por": user, "atualizado_por": user},
    )
    for field_name, value in answers.items():
        setattr(analysis, field_name, value)
    if comment is not None:
        analysis.comentario = comment
    if not created:
        analysis.atualizado_por = user
    analysis.full_clean()
    analysis.save()

    # The legacy flag remains available to existing reports, but is calculated only here.
    financeiro.analise_critica = analysis.realizada
    financeiro.save(update_fields=["analise_critica"])
    return analysis


def _build_mock_followups(financeiro):
    base_date = (
        financeiro.data_entrega_proposta
        or financeiro.previsao_contratacao
        or financeiro.data_solicitacao_proposta
        or financeiro.data_emissao
    )
    if not base_date:
        return []

    summary = _clean_text(financeiro.follow_up) or "Acompanhar evolução comercial da proposta."
    return [
        {
            "data": _format_date_br(base_date),
            "hora": "10:00",
            "responsavel": _clean_text(financeiro.responsavel),
            "tipoContato": "Acompanhamento comercial",
            "comentario": summary,
            "proximaAcao": summary,
            "dataProximaAcao": _format_date_br(financeiro.previsao_contratacao or base_date),
            "status": FOLLOWUP_STATUSES[0],
        }
    ]


def _build_mock_history(financeiro):
    history = []
    if financeiro.data_emissao:
        history.append(
            {
                "dataHora": f"{_format_date_br(financeiro.data_emissao)} 09:00",
                "usuario": _clean_text(financeiro.responsavel),
                "acao": "Proposta criada",
                "detalhe": "Registro inicial da proposta comercial no módulo Comercial.",
            }
        )
    history.append(
        {
            "dataHora": f"{_format_date_br(date.today())} 10:00",
            "usuario": _clean_text(financeiro.responsavel),
            "acao": "Status carregado",
            "detalhe": f"Status atual da proposta: {_display_status(financeiro.status_proposta)}.",
        }
    )
    return history


def _build_default_followup_item(financeiro, summary=""):
    base_date = (
        financeiro.data_entrega_proposta
        or financeiro.previsao_contratacao
        or financeiro.data_solicitacao_proposta
        or financeiro.data_emissao
    )
    if not base_date:
        return None

    normalized_summary = _clean_text(summary) or "Acompanhar evolução comercial da proposta."
    return {
        "data": _format_date_br(base_date),
        "hora": "10:00",
        "responsavel": _clean_text(getattr(financeiro.responsavel_cadastro, "nome", "")) or _clean_text(financeiro.responsavel),
        "tipoContato": "Acompanhamento comercial",
        "comentario": normalized_summary,
        "proximaAcao": normalized_summary,
        "dataProximaAcao": _format_date_br(financeiro.previsao_contratacao or base_date),
        "status": FOLLOWUP_STATUSES[0],
    }


def _build_default_history(financeiro):
    history = []
    if financeiro.data_emissao:
        history.append(
            {
                "dataHora": f"{_format_date_br(financeiro.data_emissao)} 09:00",
                "usuario": _clean_text(financeiro.responsavel),
                "acao": "Proposta criada",
                "detalhe": "Registro inicial da proposta comercial no módulo Comercial.",
            }
        )
    return history


def _normalize_followup_item(item, financeiro):
    if not isinstance(item, dict):
        return None

    normalized = {
        "data": _clean_text(item.get("data")),
        "hora": _clean_text(item.get("hora")) or "09:00",
        "responsavel": _clean_text(item.get("responsavel")) or _clean_text(financeiro.responsavel),
        "tipoContato": _clean_text(item.get("tipoContato")) or "Acompanhamento comercial",
        "comentario": _clean_text(item.get("comentario")),
        "proximaAcao": _clean_text(item.get("proximaAcao")) or _clean_text(item.get("comentario")),
        "dataProximaAcao": _clean_text(item.get("dataProximaAcao")) or _clean_text(item.get("data")),
        "status": _clean_text(item.get("status")) or FOLLOWUP_STATUSES[0],
    }

    if not normalized["data"] and not normalized["dataProximaAcao"]:
        fallback = _build_default_followup_item(financeiro, normalized["proximaAcao"] or normalized["comentario"])
        if fallback:
            normalized["data"] = fallback["data"]
            normalized["dataProximaAcao"] = fallback["dataProximaAcao"]

    return normalized


def _normalize_history_entry(entry, financeiro):
    if not isinstance(entry, dict):
        return None

    return {
        "dataHora": _clean_text(entry.get("dataHora")) or f"{_format_date_br(date.today())} 10:00",
        "usuario": _clean_text(entry.get("usuario")) or _clean_text(financeiro.responsavel),
        "acao": _clean_text(entry.get("acao")) or "Atualização",
        "detalhe": _clean_text(entry.get("detalhe")) or "Registro atualizado no módulo Comercial.",
    }


def _load_commercial_bundle(financeiro):
    raw_value = _clean_text(financeiro.follow_up)
    bundle = {"summary": "", "items": [], "history": [], "overrides": {}}

    if not raw_value:
        return bundle

    try:
        parsed = json.loads(raw_value)
    except (TypeError, ValueError, json.JSONDecodeError):
        parsed = None

    if isinstance(parsed, dict):
        bundle["summary"] = _clean_text(parsed.get("summary"))
        bundle["items"] = [
            normalized
            for normalized in (_normalize_followup_item(item, financeiro) for item in parsed.get("items", []))
            if normalized
        ]
        bundle["history"] = [
            normalized
            for normalized in (_normalize_history_entry(item, financeiro) for item in parsed.get("history", []))
            if normalized
        ]
        raw_overrides = parsed.get("overrides", {})
        if isinstance(raw_overrides, dict):
            override_fields = (
                "empresa",
                "unidade",
                # Historical imports keep these commercial values in the bundle
                # because legacy technical foreign keys can only store one value.
                "embarcacao_local",
                "tipo_operacao",
                "servico",
            )
            bundle["overrides"] = {
                field: _clean_text(raw_overrides.get(field))
                for field in override_fields
                if field in raw_overrides
            }
        return bundle

    bundle["summary"] = raw_value
    fallback_item = _build_default_followup_item(financeiro, raw_value)
    if fallback_item:
        bundle["items"] = [fallback_item]
    return bundle


def _dump_commercial_bundle(bundle):
    payload = {
        "summary": _clean_text(bundle.get("summary")),
        "items": bundle.get("items", []),
        "history": bundle.get("history", []),
        "overrides": bundle.get("overrides", {}),
    }
    return json.dumps(payload, cls=DjangoJSONEncoder, ensure_ascii=False)


def _build_commercial_bundle(financeiro):
    bundle = _load_commercial_bundle(financeiro)
    summary = bundle.get("summary") or ""
    items = bundle.get("items", [])
    history = _build_default_history(financeiro) + bundle.get("history", [])
    overrides = bundle.get("overrides") or {}

    if not items and summary:
        fallback_item = _build_default_followup_item(financeiro, summary)
        if fallback_item:
            items = [fallback_item]

    summary_text, summary_date = _resolve_followup_summary_and_date(summary)
    if summary_date:
        summary = _format_date_br(summary_date)
        adjusted_items = []
        for item in items:
            adjusted_items.append(
                {
                    **item,
                    "data": _format_date_br(summary_date),
                    "dataProximaAcao": _format_date_br(summary_date),
                    "comentario": _clean_text(item.get("comentario")) or "Acompanhamento comercial registrado.",
                    "proximaAcao": _clean_text(item.get("proximaAcao") or item.get("comentario")) or "Acompanhamento comercial registrado.",
                }
            )
        items = adjusted_items
    else:
        summary = summary_text

    if not summary and items:
        summary = _clean_text(items[0].get("proximaAcao") or items[0].get("comentario"))

    return {"summary": summary, "items": items, "history": history, "overrides": overrides}


def _serialize_financeiro(financeiro):
    receita_informada = financeiro.estimativo_receita is not None
    receita = _safe_decimal(financeiro.estimativo_receita)
    tipo_operacao = _resolve_tipo_operacao(financeiro)
    status_display = _display_status(financeiro.status_proposta)
    kanban_stage = get_kanban_stage(financeiro.status_proposta)
    cliente_nome = _resolve_cliente_name(financeiro.cliente)
    unidade_nome_base = _resolve_unidade_name(financeiro.unidade)
    commercial_bundle = _build_commercial_bundle(financeiro)
    overrides = commercial_bundle.get("overrides") or {}
    if "empresa" in overrides:
        cliente_nome = _clean_text(overrides.get("empresa"))
    legacy_unidade_override = _clean_text(overrides.get("unidade"))
    legacy_override_is_unit = bool(_resolve_os_by_value("unidade", legacy_unidade_override))
    unidade_nome = legacy_unidade_override if "unidade" in overrides else unidade_nome_base
    embarcacao_local = (
        _clean_text(overrides.get("embarcacao_local"))
        or (legacy_unidade_override if legacy_unidade_override and not legacy_override_is_unit else unidade_nome)
    )
    campos, total_campos = _serialize_financeiro_campos(financeiro)
    critical_analysis = _serialize_critical_analysis(financeiro)

    return {
        # Use the internal identity for requests: commercial numbers may repeat in history.
        "id": financeiro.pk,
        "propostaId": financeiro.pk,
        "numeroProposta": str(financeiro.proposta),
        "numeroPropostaRaw": str(financeiro.proposta),
        "rev": f"{int(financeiro.revisao or 0):02d}",
        "emissao": _format_date_br(financeiro.data_emissao),
        "emissaoMes": f"{financeiro.data_emissao.month:02d}" if financeiro.data_emissao else "",
        "responsavel": _clean_text(financeiro.responsavel),
        "dataEntregaProposta": _format_date_br(financeiro.data_entrega_proposta),
        "dataSolicitacaoProposta": _format_date_br(financeiro.data_solicitacao_proposta),
        "dataFechamento": _format_date_br(financeiro.data_fechamento_proposta),
        "previsaoContratacao": _format_date_br(financeiro.previsao_contratacao),
        "followUp": commercial_bundle["summary"],
        "natureza": _clean_text(financeiro.natureza),
        "tipoOperacao": _clean_text(overrides.get("tipo_operacao")) if "tipo_operacao" in overrides else tipo_operacao,
        "unidade": unidade_nome,
        "heatMap": str(financeiro.heat_map if financeiro.heat_map is not None else ""),
        "statusProposta": status_display,
        "kanbanStage": kanban_stage,
        "motivoDeclinioPerda": _clean_text(financeiro.motivo_perda),
        "analiseCriticaRealizada": critical_analysis["status"],
        "analiseCriticaResumo": f"{critical_analysis['status']} - {critical_analysis['quantidadeRespondida']} de {critical_analysis['totalPerguntas']} respondidas",
        "analiseCriticaOportunidade": critical_analysis,
        "pt": _clean_text(financeiro.pt_financeiro),
        "pcPtc": _clean_text(financeiro.pc_ptc),
        "empresa": cliente_nome,
        "uf": _clean_text(financeiro.uf),
        "embarcacaoLocal": embarcacao_local,
        "escopo": _clean_text(overrides.get("servico")) or _clean_text(financeiro.servico) or _clean_text(financeiro.comentario),
        "estimativaReceita": _format_currency_br(receita) if receita_informada else "",
        "estimativaReceitaValor": float(receita) if receita_informada else None,
        "tempoContratoDias": f"{financeiro.tempo_contrato_dias} dias" if financeiro.tempo_contrato_dias else "",
        "tempoContratoDiasValor": financeiro.tempo_contrato_dias or 0,
        "solicitante": _clean_text(financeiro.solicitante),
        "emailSolicitante": _clean_text(financeiro.email_solicitante),
        "telefoneSolicitante": _clean_text(financeiro.telefone_solicitante),
        "fonteLead": _clean_text(financeiro.fonte_lead),
        "comentario": _clean_text(financeiro.comentario),
        "segmentoCliente": _clean_text(financeiro.segmento_cliente),
        "metodo": _clean_text(getattr(financeiro.metodo_cadastro, "nome", "")) or _resolve_os_string(financeiro.metodo, "metodo", ""),
        "coordenador": _clean_text(getattr(financeiro.coordenador_cadastro, "nome", "")) or _resolve_os_string(financeiro.cordenador, "coordenador", ""),
        "po": _clean_text(financeiro.po),
        "rfi": _clean_text(financeiro.rfi),
        "servico": _clean_text(overrides.get("servico")) or _clean_text(financeiro.servico),
        "atrasada": _is_proposal_late(financeiro),
        "followUps": commercial_bundle["items"],
        "historico": commercial_bundle["history"],
        "campos": campos,
        "totalCampos": _format_decimal_string(total_campos),
        "totalCamposFormatado": _format_currency_br(total_campos),
        "anexos": [_serialize_proposta_anexo(anexo) for anexo in financeiro.anexos.all()],
    }


def _serialize_agenda_followup(financeiro, item, index=0):
    commercial_bundle = _build_commercial_bundle(financeiro)
    overrides = commercial_bundle.get("overrides") or {}
    cliente_nome = overrides.get("empresa") or _resolve_cliente_name(financeiro.cliente)
    unidade_nome = overrides.get("unidade") or _resolve_unidade_name(financeiro.unidade)
    data_followup = _parse_date_input(item.get("dataProximaAcao") or item.get("data"))
    data_iso = data_followup.isoformat() if data_followup else ""

    return {
        "id": f"{financeiro.pk}-{index}",
        "proposta_id": financeiro.pk,
        "numero_proposta": str(financeiro.proposta),
        "revisao": _clean_text(financeiro.revisao),
        "cliente": cliente_nome,
        "unidade": unidade_nome,
        "status_proposta": _clean_text(financeiro.status_proposta),
        "responsavel": _clean_text(item.get("responsavel")) or _clean_text(financeiro.responsavel),
        "data": data_iso,
        "data_formatada": _format_date_br(data_followup),
        "hora": _clean_text(item.get("hora")) or "09:00",
        "status": _clean_text(item.get("status")) or FOLLOWUP_STATUSES[0],
        "titulo": _clean_text(item.get("proximaAcao") or item.get("comentario") or commercial_bundle.get("summary")),
        "comentario": _clean_text(item.get("comentario")),
        "proxima_acao": _clean_text(item.get("proximaAcao") or item.get("comentario")),
        "tipo_contato": _clean_text(item.get("tipoContato")) or "Acompanhamento comercial",
    }


def _collect_followup_agenda_items(queryset=None):
    if queryset is None:
        queryset = Financeiro.objects.select_related(
            "cliente__Cliente",
            "cliente__Unidade",
            "unidade__Cliente",
            "unidade__Unidade",
        ).order_by("-proposta")

    items = []
    for financeiro in queryset:
        bundle = _build_commercial_bundle(financeiro)
        for index, item in enumerate(bundle.get("items", []), start=1):
            serialized = _serialize_agenda_followup(financeiro, item, index=index)
            if serialized["data"]:
                items.append(serialized)

    return sorted(items, key=lambda item: (item.get("data") or "", item.get("hora") or ""))


def _parse_iso_query_date(value):
    text = _clean_text(value)
    if not text:
        return None
    try:
        return datetime.strptime(text, "%Y-%m-%d").date()
    except ValueError:
        return None


def _filter_agenda_items(items, *, search="", responsavel="Todos", status="Todos", start_date=None, end_date=None):
    search_term = _normalize_key(search)
    owner_term = _clean_text(responsavel)
    status_term = _clean_text(status)
    filtered = []

    for item in items:
        item_date = _parse_iso_query_date(item.get("data"))
        haystack = " ".join(
            [
                item.get("numero_proposta", ""),
                item.get("cliente", ""),
                item.get("unidade", ""),
                item.get("responsavel", ""),
                item.get("titulo", ""),
                item.get("comentario", ""),
            ]
        )

        if search_term and search_term not in _normalize_key(haystack):
            continue
        if owner_term and owner_term != "Todos" and _clean_text(item.get("responsavel")) != owner_term:
            continue
        if status_term and status_term != "Todos" and _clean_text(item.get("status")) != status_term:
            continue
        if start_date and item_date and item_date < start_date:
            continue
        if end_date and item_date and item_date > end_date:
            continue
        filtered.append(item)

    return filtered


def _build_followup_agenda_summary(items, today=None):
    today = today or timezone.localdate()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)

    status_pending_keys = {"pendente", "sem retorno", "reagendado", "atrasado"}
    owner_totals = {}
    hoje = 0
    esta_semana = 0
    pendentes = 0

    for item in items:
        item_date = _parse_iso_query_date(item.get("data"))
        if item_date == today:
            hoje += 1
        if item_date and week_start <= item_date <= week_end:
            esta_semana += 1

        status_key = _normalize_key(item.get("status"))
        if status_key in status_pending_keys:
            pendentes += 1

        owner = _clean_text(item.get("responsavel")) or "-"
        owner_totals[owner] = owner_totals.get(owner, 0) + 1

    if owner_totals:
        top_owner_name, top_owner_count = max(owner_totals.items(), key=lambda entry: entry[1])
    else:
        top_owner_name, top_owner_count = "-", 0

    return {
        "hoje": hoje,
        "esta_semana": esta_semana,
        "pendentes": pendentes,
        "responsavel_principal": {
            "nome": top_owner_name,
            "total": top_owner_count,
        },
    }


def _build_calendar_days(items):
    counts = {}
    for item in items:
        item_date = _clean_text(item.get("data"))
        if not item_date:
            continue
        counts[item_date] = counts.get(item_date, 0) + 1

    return [{"date": day, "count": total} for day, total in sorted(counts.items())]


def _agenda_status_options(items):
    ordered = []
    seen = set()
    for item in items:
        status = _clean_text(item.get("status"))
        key = _normalize_key(status)
        if not status or key in seen:
            continue
        seen.add(key)
        ordered.append(status)
    return ["Todos", *ordered] if ordered else ["Todos", *FOLLOWUP_STATUSES]


def _agenda_responsavel_options(items):
    ordered = []
    seen = set()
    for item in items:
        responsavel = _clean_text(item.get("responsavel"))
        key = _normalize_key(responsavel)
        if not responsavel or key in seen:
            continue
        seen.add(key)
        ordered.append(responsavel)
    return ["Todos", *ordered]


def _user_responsavel_names(user):
    """Resolve os responsáveis comerciais que pertencem ao usuário autenticado.

    A base atual ainda não possui uma FK direta entre usuário e responsável.
    Enquanto essa relação não existe, a associação é feita apenas por identidade
    normalizada do nome completo, login e e-mail, sempre no servidor.
    """
    raw_candidates = [
        user.get_full_name(),
        user.get_username(),
        getattr(user, "email", ""),
    ]
    candidates = set()
    for raw_value in raw_candidates:
        text = _clean_text(raw_value)
        if not text:
            continue
        candidates.add(_normalize_key(text))
        candidates.add(_normalize_key(text.split("@", 1)[0].replace(".", " ").replace("_", " ").replace("-", " ")))

    names = []
    for person in ResponsavelCoordenador.objects.filter(ativo=True, responsavel_comercial=True).order_by("nome"):
        if _normalize_key(person.nome) in candidates:
            names.append(person.nome)
    return names


def _can_view_all_commercial_followups(user):
    """Administradores consultam a agenda completa; os demais, apenas a própria."""
    return bool(
        getattr(user, "is_superuser", False)
        or user_can_manage_rdo_permission_users(user)
        or user_can_manage_responsaveis_coordenadores(user)
    )


def _collect_current_user_followup_items(user):
    if _can_view_all_commercial_followups(user):
        return _collect_followup_agenda_items(), []

    responsible_names = _user_responsavel_names(user)
    if not responsible_names:
        return [], []

    allowed_keys = {_normalize_key(name) for name in responsible_names}
    items = [
        item
        for item in _collect_followup_agenda_items()
        if _normalize_key(item.get("responsavel")) in allowed_keys
    ]
    return items, responsible_names


def _is_proposal_late(financeiro):
    if not financeiro.data_entrega_proposta:
        return False
    if _normalize_key(financeiro.status_proposta) in FINAL_STATUS_KEYS:
        return False
    return financeiro.data_entrega_proposta < date.today()


def _calculate_kpis(serialized_proposals):
    today = timezone.localdate()
    total_receita = sum(Decimal(str(item.get("estimativaReceitaValor") or 0)) for item in serialized_proposals)
    total = len(serialized_proposals)
    propostas_mes = sum(
        1
        for item in serialized_proposals
        if (emissao := _parse_date_input(item.get("emissao")))
        and emissao.year == today.year
        and emissao.month == today.month
    )
    aguardando_aprovacao = sum(
        1
        for item in serialized_proposals
        if _normalize_key(item.get("statusProposta"))
        in {"aguardando aprovacao gestores", "aguardando aprovacao dos gestores"}
    )
    contratadas = sum(
        1
        for item in serialized_proposals
        if _normalize_key(item.get("statusProposta")) in {"fechada/contratada", "fechada / contratada", "contratada"}
    )
    canceladas = sum(
        1
        for item in serialized_proposals
        if _normalize_key(item.get("statusProposta")) == "cancelada"
    )

    return [
        {"icon": "description", "title": "Total de Propostas", "value": str(total), "filterType": "all"},
        {"icon": "payments", "title": "Receita Estimada Total", "value": _format_currency_br(total_receita)},
        {"icon": "calendar_month", "title": "Propostas no Mês", "value": str(propostas_mes), "filterType": "propostas-mes"},
        {"icon": "approval", "title": "Aguardando Aprovação", "value": str(aguardando_aprovacao), "filterType": "aguardando-aprovacao", "attention": True},
        {"icon": "check_circle", "title": "Contratadas", "value": str(contratadas), "filterType": "contratadas"},
        {"icon": "cancel", "title": "Canceladas", "value": str(canceladas), "filterType": "canceladas"},
    ]


def _calculate_revenue_by_stage(serialized_proposals):
    amounts = {stage: Decimal("0") for stage in KANBAN_STAGE_KEYS}
    for item in serialized_proposals:
        stage = item.get("kanbanStage")
        if stage in amounts:
            amounts[stage] += Decimal(str(item.get("estimativaReceitaValor") or 0))

    return [
        {
            "key": stage["key"],
            "label": stage["label"],
            "value": _format_stage_revenue_br(amounts[stage["key"]]),
            "amount": float(amounts[stage["key"]]),
            "highlight": stage["key"] == "contratadas",
        }
        for stage in KANBAN_STAGES
    ]

def _distinct_ordered_values(values):
    seen = set()
    output = []
    for value in values:
        cleaned = _clean_text(value)
        if not cleaned:
            continue
        key = _normalize_key(cleaned)
        if key in seen:
            continue
        seen.add(key)
        output.append(cleaned)
    return output


def _build_metadata():
    ordem_servicos = OrdemServico.objects.select_related("Cliente", "Unidade").order_by("-id")[:500]

    clientes = list(Cliente.objects.order_by("nome").values_list("nome", flat=True))
    unidades = list(Unidade.objects.order_by("nome").values_list("nome", flat=True))
    solicitantes = _distinct_ordered_values(getattr(item, "solicitante", "") for item in ordem_servicos)
    coordenadores = _distinct_ordered_values(getattr(item, "coordenador", "") for item in ordem_servicos)
    servicos = _distinct_ordered_values([
        *[choice[0] for choice in OrdemServico.SERVICO_CHOICES],
        *ServicoComercial.objects.filter(ativo=True).order_by("nome").values_list("nome", flat=True),
    ])
    metodos = _distinct_ordered_values(getattr(item, "metodo", "") for item in ordem_servicos)
    pos = _distinct_ordered_values(getattr(item, "po", "") for item in ordem_servicos)

    return {
        "responsaveis": list(ResponsavelCoordenador.objects.filter(ativo=True, responsavel_comercial=True).order_by("nome").values_list("nome", flat=True)),
        "naturezas": COMMERCIAL_NATURE_OPTIONS,
        "heatMaps": [{"value": str(value), "label": label} for value, label in Financeiro._meta.get_field("heat_map").choices],
        "statusOptions": [item for item in [
            "Sem Retorno",
            "Em Análise",
            "ShortList",
            "Revisada",
            "Perdida/Recusada",
            "Fechada/Contratada",
            "Cancelada",
            "Em Elaboração",
            "Declínio",
            "Avaliando escopo",
            "Aguardando aprovação gestores",
        ]],
        "tipoOperacaoOptions": [choice[0] for choice in OrdemServico.TIPO_OP_CHOICES],
        "metodoOptions": list(MetodoOperacional.objects.filter(ativo=True).order_by("nome").values_list("nome", flat=True)),
        "coordenadorOptions": list(ResponsavelCoordenador.objects.filter(ativo=True, coordenador=True).order_by("nome").values_list("nome", flat=True)),
        "ufOptions": [choice[0] for choice in Financeiro._meta.get_field("uf").choices],
        "fonteLeadOptions": [choice[0] for choice in Financeiro._meta.get_field("fonte_lead").choices],
        "segmentoOptions": _distinct_ordered_values([
            *[choice[0] for choice in Financeiro._meta.get_field("segmento_cliente").choices],
            *SegmentoClienteComercial.objects.filter(ativo=True).order_by("nome").values_list("nome", flat=True),
        ]),
        "motivoPerdaOptions": [choice[0] for choice in Financeiro._meta.get_field("motivo_perda").choices],
        "ptOptions": [choice[0] for choice in Financeiro._meta.get_field("pt_financeiro").choices],
        "pcOptions": [choice[0] for choice in Financeiro._meta.get_field("pc_ptc").choices],
        "financeiroCampoChoices": [
            {
                "value": value,
                "label": label,
                "group": "Serviços" if value == "SERVICO_LIMPEZA_TANQUES" else "Equipamentos e Taxas",
            }
            for value, label in FinanceiroCampo._meta.get_field("nome").choices
        ] + [
            {"value": item.nome, "label": item.nome, "group": "Itens cadastrados"}
            for item in ItemEquipamentoComercial.objects.filter(ativo=True).order_by("nome")
        ],
        "clientes": clientes,
        "unidades": unidades,
        "solicitantes": solicitantes,
        "coordenadores": coordenadores,
        "servicos": servicos,
        "metodosDistinct": metodos,
        "poOptions": pos,
        "nextProposalNumber": _get_next_proposal_number(),
    }


def _build_bootstrap_payload():
    propostas = [
        _serialize_financeiro(item)
        for item in Financeiro.objects.select_related(
            "cliente__Cliente",
            "cliente__Unidade",
            "unidade__Cliente",
            "unidade__Unidade",
            "tipo_operacao",
            "metodo",
            "metodo_cadastro",
            "cordenador",
            "analise_critica_oportunidade",
        ).prefetch_related("campos", "anexos__enviado_por").order_by("-proposta")
    ]

    detail_pattern = reverse("comercial_detalhe_proposta", args=[0]).replace("/0/", "/__id__/")
    status_pattern = reverse("comercial_atualizar_status", args=[0]).replace("/0/", "/__id__/")
    update_pattern = reverse("comercial_atualizar_proposta", args=[0]).replace("/0/", "/__id__/")
    pdf_pattern = reverse("comercial_gerar_pdf_proposta", args=[0]).replace("/0/", "/__id__/")
    critical_analysis_pdf_pattern = reverse("comercial_gerar_pdf_analise_critica", args=[0]).replace("/0/", "/__id__/")
    document_review_pattern = reverse("comercial_revisao_documento_proposta", args=[0]).replace("/0/", "/__id__/")
    document_review_save_pattern = reverse("comercial_salvar_revisao_documento_proposta", args=[0]).replace("/0/", "/__id__/")
    document_review_image_upload_pattern = reverse("comercial_enviar_imagens_revisao_documento", args=[0]).replace("/0/", "/__id__/")
    document_review_image_delete_pattern = reverse("comercial_excluir_imagem_revisao_documento", args=[0, 0]).replace("/0/", "/__id__/", 1).replace("/0/", "/__image_id__/", 1)
    attachment_list_pattern = reverse("comercial_listar_anexos_proposta", args=[0]).replace("/0/", "/__id__/")
    attachment_upload_pattern = reverse("comercial_enviar_anexos_proposta", args=[0]).replace("/0/", "/__id__/")

    return {
        "proposals": propostas,
        "kpis": _calculate_kpis(propostas),
        "revenueByStage": _calculate_revenue_by_stage(propostas),
        "kanbanStages": KANBAN_STAGES,
        "metadata": _build_metadata(),
        "endpoints": {
            "create": reverse("comercial_criar_proposta"),
            "detailPattern": detail_pattern,
            "statusPattern": status_pattern,
            "updatePattern": update_pattern,
            "pdfPattern": pdf_pattern,
            "criticalAnalysisPdfPattern": critical_analysis_pdf_pattern,
            "documentReviewPattern": document_review_pattern,
            "documentReviewSavePattern": document_review_save_pattern,
            "documentReviewImageUploadPattern": document_review_image_upload_pattern,
            "documentReviewImageDeletePattern": document_review_image_delete_pattern,
            "attachmentListPattern": attachment_list_pattern,
            "attachmentUploadPattern": attachment_upload_pattern,
            "quickClientCreate": reverse("comercial_criar_cliente"),
            "quickUnitCreate": reverse("comercial_criar_unidade"),
            "quickMethodCreate": reverse("comercial_criar_metodo"),
            "quickServiceCreate": reverse("comercial_criar_servico"),
            "quickItemCreate": reverse("comercial_criar_item_equipamento"),
            "quickSegmentCreate": reverse("comercial_criar_segmento"),
            "catalogMetadata": reverse("comercial_catalogos"),
            "agendaList": reverse("comercial_agenda_followups"),
            "agendaCreate": reverse("comercial_criar_followup"),
        },
        "today": timezone.localdate().isoformat(),
    }


def _filter_serialized_proposals_for_home(
    proposals_list,
    *,
    search="",
    numero="",
    status="",
    natureza="",
    status_proposta="",
    tipo_operacao="",
    responsavel="",
    cliente="",
    unidade="",
    uf="",
    segmento_cliente="",
    fonte_lead="",
    heat_map="",
    motivo_perda="",
    prazo="",
    kpi_filter="",
    focused_stage="",
):
    normalized_search = _clean_text(search).lower()
    normalized_numero = _clean_text(numero).lower()
    normalized_cliente = _clean_text(cliente).lower()
    normalized_unidade = _clean_text(unidade).lower()
    filtered = []

    for proposal in proposals_list:
        haystack = " ".join(
            [
                _clean_text(proposal.get("numeroProposta")),
                _clean_text(proposal.get("empresa")),
                _clean_text(proposal.get("unidade")),
                _clean_text(proposal.get("responsavel")),
                _clean_text(proposal.get("statusProposta")),
                _clean_text(proposal.get("tipoOperacao")),
            ]
        ).lower()

        if normalized_search and normalized_search not in haystack:
            continue
        if normalized_numero and normalized_numero not in _clean_text(proposal.get("numeroProposta")).lower():
            continue
        if status and proposal.get("kanbanStage") != status:
            continue
        if natureza and proposal.get("natureza") != natureza:
            continue
        if status_proposta and proposal.get("statusProposta") != status_proposta:
            continue
        if tipo_operacao and proposal.get("tipoOperacao") != tipo_operacao:
            continue
        if responsavel and proposal.get("responsavel") != responsavel:
            continue
        if normalized_cliente and normalized_cliente not in _clean_text(proposal.get("empresa")).lower():
            continue
        if normalized_unidade and normalized_unidade not in _clean_text(proposal.get("unidade")).lower():
            continue
        if uf and proposal.get("uf") != uf:
            continue
        if segmento_cliente and proposal.get("segmentoCliente") != segmento_cliente:
            continue
        if fonte_lead and proposal.get("fonteLead") != fonte_lead:
            continue
        if heat_map and proposal.get("heatMap") != heat_map:
            continue
        if motivo_perda and proposal.get("motivoDeclinioPerda") != motivo_perda:
            continue
        if prazo == "atrasada" and not proposal.get("atrasada"):
            continue
        if prazo == "em_dia" and proposal.get("atrasada"):
            continue

        filtered.append(proposal)

    if focused_stage:
        filtered = [proposal for proposal in filtered if proposal.get("kanbanStage") == focused_stage]

    if kpi_filter == "propostas-mes":
        today = timezone.localdate()
        filtered = [
            proposal
            for proposal in filtered
            if (emissao := _parse_date_input(proposal.get("emissao")))
            and emissao.year == today.year
            and emissao.month == today.month
        ]
    elif kpi_filter == "aguardando-aprovacao":
        filtered = [
            proposal
            for proposal in filtered
            if _normalize_key(proposal.get("statusProposta"))
            in {"aguardando aprovacao gestores", "aguardando aprovacao dos gestores"}
        ]
    elif kpi_filter == "contratadas":
        filtered = [proposal for proposal in filtered if proposal.get("kanbanStage") == "contratadas"]
    elif kpi_filter == "canceladas":
        filtered = [proposal for proposal in filtered if proposal.get("kanbanStage") == "canceladas"]

    return filtered


def _build_comercial_export_rows(proposals_list):
    rows = []
    for proposal in proposals_list:
        rows.append(
            {
                "Nº da Proposta": proposal.get("numeroPropostaRaw") or proposal.get("numeroProposta"),
                "REV": proposal.get("rev"),
                "Emissão": proposal.get("emissao"),
                "Responsável Comercial": proposal.get("responsavel"),
                "Empresa / Cliente": proposal.get("empresa"),
                "Unidade": proposal.get("unidade"),
                "Tipo de Operação": proposal.get("tipoOperacao"),
                "Natureza": proposal.get("natureza"),
                "Status da Proposta": proposal.get("statusProposta"),
                "Fase do Pipeline": next(
                    (stage["label"] for stage in KANBAN_STAGES if stage["key"] == proposal.get("kanbanStage")),
                    "Não mapeada",
                ),
                "Data de Entrega da Proposta": proposal.get("dataEntregaProposta"),
                "Data de Solicitação da Proposta": proposal.get("dataSolicitacaoProposta"),
                "Previsão de Contratação": proposal.get("previsaoContratacao"),
                "Data de Fechamento": proposal.get("dataFechamento"),
                "Acompanhamento": proposal.get("followUp"),
                "Heat Map": proposal.get("heatMap"),
                "Estimativa de Receita": proposal.get("estimativaReceita"),
                "Tempo de Contrato": proposal.get("tempoContratoDias"),
                "Solicitante": proposal.get("solicitante"),
                "Fonte do Lead": proposal.get("fonteLead"),
                "Segmento Cliente": proposal.get("segmentoCliente"),
                "UF": proposal.get("uf"),
                "Motivo de Declínio / Perda": proposal.get("motivoDeclinioPerda"),
                "Serviço / Escopo": proposal.get("servico") or proposal.get("escopo"),
                "Comentário": proposal.get("comentario"),
            }
        )
    return rows


def _read_request_json(request):
    try:
        return json.loads(request.body.decode("utf-8"))
    except (TypeError, ValueError, json.JSONDecodeError):
        return {}


def _resolve_os_by_value(field_name, raw_value):
    value = _clean_text(raw_value)
    if not value:
        return None

    if value.isdigit():
        record = OrdemServico.objects.filter(pk=int(value)).first()
        if record:
            return record
        record = OrdemServico.objects.filter(numero_os=int(value)).first()
        if record:
            return record

    if field_name == "cliente":
        return OrdemServico.objects.select_related("Cliente").filter(Cliente__nome__iexact=value).order_by("-id").first()
    if field_name == "unidade":
        return OrdemServico.objects.select_related("Unidade").filter(Unidade__nome__iexact=value).order_by("-id").first()
    if field_name == "solicitante":
        return OrdemServico.objects.filter(solicitante__iexact=value).order_by("-id").first()
    if field_name == "tipo_operacao":
        return OrdemServico.objects.filter(tipo_operacao__iexact=value).order_by("-id").first()
    if field_name == "metodo":
        return OrdemServico.objects.filter(metodo__iexact=value).order_by("-id").first()
    if field_name == "cordenador":
        return OrdemServico.objects.filter(coordenador__iexact=value).order_by("-id").first()
    if field_name == "servico":
        return OrdemServico.objects.filter(servico__iexact=value).order_by("-id").first()
    if field_name == "po":
        return OrdemServico.objects.filter(po__iexact=value).order_by("-id").first()

    return None


def _resolve_active_method(raw_value):
    name = _clean_text(raw_value)
    if not name:
        return None
    return MetodoOperacional.objects.filter(nome__iexact=name, ativo=True).first()


def _resolve_support_references(payload):
    resolved = {
        "po": _resolve_os_by_value("po", payload.get("po")),
        "cliente": _resolve_os_by_value("cliente", payload.get("cliente")),
        "unidade": _resolve_os_by_value("unidade", payload.get("unidade")),
        "solicitante": _resolve_os_by_value("solicitante", payload.get("solicitante")),
        "tipo_operacao": _resolve_os_by_value("tipo_operacao", payload.get("tipo_operacao")),
        "cordenador": _resolve_os_by_value("cordenador", payload.get("coordenador") or payload.get("cordenador")),
        "servico": _resolve_os_by_value("servico", payload.get("servico")),
    }

    base_os = next((item for item in resolved.values() if item is not None), None)
    if base_os is None:
        base_os = OrdemServico.objects.order_by("-id").first()

    tanque = RdoTanque.objects.order_by("-id").first()
    return resolved, base_os, tanque


def _resolve_active_person(raw_value, role):
    name = _clean_text(raw_value)
    if not name:
        return None
    filters = {'nome__iexact': name, 'ativo': True}
    filters['responsavel_comercial' if role == 'responsavel' else 'coordenador'] = True
    return ResponsavelCoordenador.objects.filter(**filters).first()


def _create_financeiro_from_payload(payload):
    proposal_number = _get_next_proposal_number(lock=True)
    will_not_participate = _proposal_will_not_participate(payload)

    revisao_text = _clean_text(payload.get("revisao") or payload.get("rev"))
    if not revisao_text.isdigit():
        if will_not_participate and not revisao_text:
            revisao_text = "0"
        else:
            return None, {"revisao": "Informe uma revisão válida."}

    resolved_refs, base_os, tank = _resolve_support_references(payload)
    if base_os is None:
        return None, {
            "referencias": "Cadastre ao menos uma Ordem de Serviço para vincular os campos obrigatórios do Financeiro."
        }
    if tank is None:
        return None, {
            "volume_tanque_exec": "Cadastre ao menos um tanque em RDO para concluir a primeira integração do Comercial."
        }

    emissao = _parse_date_input(payload.get("data_emissao"))
    data_entrega = _parse_date_input(payload.get("data_entrega_proposta"))
    data_solicitacao = _parse_date_input(payload.get("data_solicitacao_proposta"))
    fallback_date = timezone.localdate() if will_not_participate else None
    previsao_contratacao = _parse_date_input(payload.get("previsao_contratacao")) or data_entrega or data_solicitacao or fallback_date
    data_fechamento = _parse_date_input(payload.get("data_fechamento_proposta"))

    responsavel_cadastro = _resolve_active_person(payload.get("responsavel"), "responsavel")
    coordenador_cadastro = _resolve_active_person(payload.get("coordenador") or payload.get("cordenador"), "coordenador")
    metodo_cadastro = _resolve_active_method(payload.get("metodo"))
    fields = {
        "proposta": proposal_number,
        "revisao": int(revisao_text),
        "data_emissao": emissao,
        "data_solicitacao_proposta": data_solicitacao or fallback_date,
        "data_fechamento_proposta": data_fechamento,
        "previsao_contratacao": previsao_contratacao,
        "follow_up": _clean_text(payload.get("follow_up")),
        "natureza": _clean_text(payload.get("natureza")) or ("Spot" if will_not_participate else ""),
        "heat_map": int(str(payload.get("heat_map") or "0")),
        "motivo_perda": _clean_text(payload.get("motivo_perda")) or "N/A",
        "po": _clean_text(payload.get("po")),
        "rfi": _clean_text(payload.get("rfi")),
        "cliente": resolved_refs["cliente"] or base_os,
        "unidade": resolved_refs["unidade"] or base_os,
        "solicitante": _clean_text(payload.get("solicitante")),
        "email_solicitante": _clean_text(payload.get("email_solicitante")),
        "telefone_solicitante": _clean_text(payload.get("telefone_solicitante")),
        "tipo_operacao": resolved_refs["tipo_operacao"] or base_os,
        "metodo": base_os,
        "metodo_cadastro": metodo_cadastro,
        "data_inicio_frente": base_os,
        "data_fim": base_os,
        "data_fim_frente": base_os,
        "data_entrega_proposta": data_entrega,
        "tempo_contrato_dias": int(payload.get("tempo_contrato_dias") or 0) or None,
        "status_proposta": _clean_text(payload.get("status_proposta")) or ("Declínio" if will_not_participate else ""),
        "cordenador": resolved_refs["cordenador"] or base_os,
        "responsavel": _clean_text(payload.get("responsavel")) or ("Não informado" if will_not_participate else ""),
        "responsavel_cadastro": responsavel_cadastro,
        "coordenador_cadastro": coordenador_cadastro,
        "servico": _clean_text(payload.get("servico")),
        "volume_tanque_exec": tank,
        "comentario": _clean_text(payload.get("comentario")),
        "requisitos_cliente": _clean_text(payload.get("requisitos_cliente")),
        "requisitos_ambipar": _clean_text(payload.get("requisitos_ambipar")),
        "treinamentos": _clean_text(payload.get("treinamentos")),
        "ajuste_operacional": _clean_text(payload.get("ajuste_operacional")),
        # The legacy flag is recalculated after the individual analysis responses are saved.
        "analise_critica": False,
        "pt_financeiro": _clean_text(payload.get("pt_financeiro")) or "Pendente",
        "pc_ptc": _clean_text(payload.get("pc_ptc")) or "Pendente",
        "uf": _clean_text(payload.get("uf")) or "RJ",
        "estimativo_receita": _parse_decimal_input(payload.get("estimativo_receita")),
        "fonte_lead": _clean_text(payload.get("fonte_lead")),
        "segmento_cliente": _clean_text(payload.get("segmento_cliente")),
        # Campos legados do Financeiro permanecem zerados; os itens reais agora sÃ£o persistidos em FinanceiroCampo.
    }

    required_messages = {}
    if not will_not_participate and not fields["data_emissao"]:
        required_messages["data_emissao"] = "Informe a data de emissão."
    if not will_not_participate and not fields["data_solicitacao_proposta"]:
        required_messages["data_solicitacao_proposta"] = "Informe a data de solicitação da proposta."
    if not will_not_participate and not fields["data_entrega_proposta"]:
        required_messages["data_entrega_proposta"] = "Informe a data de entrega da proposta."
    if not will_not_participate and not fields["responsavel"]:
        required_messages["responsavel"] = "Selecione o responsável comercial."
    elif not will_not_participate and responsavel_cadastro is None:
        required_messages["responsavel"] = "Selecione um responsável comercial ativo."
    if not will_not_participate and not fields["natureza"]:
        required_messages["natureza"] = "Selecione a natureza."
    if not will_not_participate and not fields["status_proposta"]:
        required_messages["status_proposta"] = "Selecione o status da proposta."
    if not will_not_participate and not _clean_text(payload.get("cliente")):
        required_messages["cliente"] = "Selecione um cliente."
    if not will_not_participate and not _clean_text(payload.get("unidade")):
        required_messages["unidade"] = "Selecione uma unidade."
    if not will_not_participate and not _clean_text(payload.get("servico")):
        required_messages["servico"] = "Selecione um serviço."
    if not will_not_participate and _clean_text(payload.get("metodo")) and metodo_cadastro is None:
        required_messages["metodo"] = "Selecione ou cadastre um método ativo."
    if not will_not_participate and fields["estimativo_receita"] <= 0:
        required_messages["estimativo_receita"] = "Informe uma estimativa de receita válida."
    if fields["email_solicitante"]:
        try:
            validate_email(fields["email_solicitante"])
        except ValidationError:
            required_messages["email_solicitante"] = "Informe um e-mail válido."

    if required_messages:
        return None, required_messages

    financeiro = Financeiro(**fields)
    _apply_commercial_bundle_overrides(financeiro, payload)
    return financeiro, {}


def _append_history_to_bundle(financeiro, history_entry):
    if not history_entry:
        return

    bundle = _load_commercial_bundle(financeiro)
    normalized = _normalize_history_entry(history_entry, financeiro)
    if normalized:
        bundle["history"].insert(0, normalized)
        financeiro.follow_up = _dump_commercial_bundle(bundle)


def _store_followup_item(financeiro, followup_item):
    normalized = _normalize_followup_item(followup_item, financeiro)
    if not normalized:
        return

    bundle = _load_commercial_bundle(financeiro)
    bundle["items"] = [item for item in bundle.get("items", []) if item != normalized]
    bundle["items"].insert(0, normalized)
    bundle["summary"] = _clean_text(normalized.get("proximaAcao") or normalized.get("comentario"))
    financeiro.follow_up = _dump_commercial_bundle(bundle)


def _apply_commercial_bundle_overrides(financeiro, payload):
    bundle = _load_commercial_bundle(financeiro)

    if "follow_up" in payload:
        bundle["summary"] = _clean_text(payload.get("follow_up"))

    followup_date = _parse_date_input(payload.get("follow_up_date"))
    if followup_date:
        summary = _clean_text(payload.get("follow_up")) or _clean_text(bundle.get("summary"))
        summary = summary or "Acompanhamento comercial previsto."
        initial_item = _normalize_followup_item(
            {
                "data": _format_date_br(followup_date),
                "dataProximaAcao": _format_date_br(followup_date),
                "responsavel": _clean_text(payload.get("responsavel")) or _clean_text(financeiro.responsavel),
                "tipoContato": "Acompanhamento comercial",
                "comentario": summary,
                "proximaAcao": summary,
                "status": "Pendente",
            },
            financeiro,
        )
        if initial_item:
            bundle["items"] = [initial_item, *bundle.get("items", [])]
            bundle["summary"] = summary

    overrides = bundle.get("overrides") or {}
    empresa = _clean_text(payload.get("cliente"))
    unidade = _clean_text(payload.get("unidade"))
    embarcacao_local = _clean_text(payload.get("embarcacao_local"))

    if empresa:
        overrides["empresa"] = empresa
    if unidade:
        overrides["unidade"] = unidade
    if embarcacao_local:
        overrides["embarcacao_local"] = embarcacao_local

    bundle["overrides"] = overrides
    financeiro.follow_up = _dump_commercial_bundle(bundle)


def _parse_financeiro_campos_payload(payload):
    raw_items = payload.get("campos", [])
    if not isinstance(raw_items, list):
        return [], {"campos": "Informe uma lista válida de itens da proposta."}

    valid_codes = {value for value, _label in FinanceiroCampo._meta.get_field("nome").choices}
    valid_codes.update(ItemEquipamentoComercial.objects.filter(ativo=True).values_list("nome", flat=True))
    parsed_items = []
    errors = {}

    for index, raw_item in enumerate(raw_items):
        if not isinstance(raw_item, dict):
            errors[f"campos[{index}]"] = "Item inválido."
            continue

        nome = _clean_text(raw_item.get("nome"))
        preco_unitario = _parse_decimal_input(raw_item.get("preco_unitario"))
        quantidade = _parse_decimal_input(raw_item.get("quantidade") or 1)

        has_any_value = bool(nome or raw_item.get("preco_unitario") not in (None, "", 0, "0") or raw_item.get("quantidade") not in (None, "", 0, "0"))
        if not has_any_value:
            continue

        if not nome:
            errors[f"campos[{index}].nome"] = "Selecione um item/equipamento."
        elif nome not in valid_codes:
            errors[f"campos[{index}].nome"] = "O item/equipamento informado é inválido."

        if preco_unitario <= 0:
            errors[f"campos[{index}].preco_unitario"] = "Informe um preço unitário válido."

        if quantidade <= 0:
            errors[f"campos[{index}].quantidade"] = "Informe uma quantidade válida."

        if any(key.startswith(f"campos[{index}]") for key in errors):
            continue

        parsed_items.append(
            {
                "nome": nome,
                "preco_unitario": preco_unitario,
                "quantidade": quantidade,
            }
        )

    return parsed_items, errors


def _sync_financeiro_campos(financeiro, campos):
    financeiro.campos.all().delete()
    for item in campos:
        FinanceiroCampo.objects.create(
            financeiro=financeiro,
            nome=item["nome"],
            preco_unitario=item["preco_unitario"],
            quantidade=item["quantidade"],
        )


def _update_financeiro_from_payload(financeiro, payload):
    errors = {}
    will_not_participate = _proposal_will_not_participate(payload)

    text_fields = {
        "po": "po",
        "rfi": "rfi",
        "responsavel": "responsavel",
        "natureza": "natureza",
        "status_proposta": "status_proposta",
        "solicitante": "solicitante",
        "email_solicitante": "email_solicitante",
        "telefone_solicitante": "telefone_solicitante",
        "servico": "servico",
        "motivo_perda": "motivo_perda",
        "comentario": "comentario",
        "requisitos_cliente": "requisitos_cliente",
        "requisitos_ambipar": "requisitos_ambipar",
        "treinamentos": "treinamentos",
        "ajuste_operacional": "ajuste_operacional",
        "pt_financeiro": "pt_financeiro",
        "pc_ptc": "pc_ptc",
        "uf": "uf",
        "fonte_lead": "fonte_lead",
        "segmento_cliente": "segmento_cliente",
    }
    for payload_key, model_field in text_fields.items():
        if payload_key in payload:
            setattr(financeiro, model_field, _clean_text(payload.get(payload_key)))

    if will_not_participate:
        financeiro.natureza = financeiro.natureza or "Spot"
        financeiro.status_proposta = financeiro.status_proposta or "Declínio"
        financeiro.responsavel = financeiro.responsavel or "Não informado"

    if "email_solicitante" in payload and financeiro.email_solicitante:
        try:
            validate_email(financeiro.email_solicitante)
        except ValidationError:
            errors["email_solicitante"] = "Informe um e-mail válido."

    date_fields = {
        "data_emissao": "data_emissao",
        "data_entrega_proposta": "data_entrega_proposta",
        "data_solicitacao_proposta": "data_solicitacao_proposta",
        "data_fechamento_proposta": "data_fechamento_proposta",
        "previsao_contratacao": "previsao_contratacao",
    }
    for payload_key, model_field in date_fields.items():
        if payload_key in payload:
            parsed_date = _parse_date_input(payload.get(payload_key))
            if will_not_participate and model_field in {"data_solicitacao_proposta", "previsao_contratacao"}:
                parsed_date = parsed_date or timezone.localdate()
            setattr(financeiro, model_field, parsed_date)

    if "revisao" in payload:
        revisao_text = _clean_text(payload.get("revisao"))
        if revisao_text.isdigit():
            financeiro.revisao = int(revisao_text)
        else:
            errors["revisao"] = "Informe uma revisão válida."

    if "heat_map" in payload:
        heat_map_text = _clean_text(payload.get("heat_map"))
        if heat_map_text.isdigit():
            financeiro.heat_map = int(heat_map_text)
        elif heat_map_text:
            errors["heat_map"] = "Informe um heat map válido."

    if "tempo_contrato_dias" in payload:
        tempo_text = _clean_text(payload.get("tempo_contrato_dias"))
        if not tempo_text:
            financeiro.tempo_contrato_dias = None
        elif tempo_text.isdigit():
            financeiro.tempo_contrato_dias = int(tempo_text)
        else:
            errors["tempo_contrato_dias"] = "Informe um tempo de contrato válido."

    if "estimativo_receita" in payload:
        financeiro.estimativo_receita = _parse_decimal_input(payload.get("estimativo_receita"))

    os_field_map = {
        "cliente": "cliente",
        "unidade": "unidade",
        "tipo_operacao": "tipo_operacao",
        "cordenador": "cordenador",
    }
    for payload_key, model_field in os_field_map.items():
        if payload_key not in payload:
            continue
        raw_value = payload.get(payload_key)
        cleaned_value = _clean_text(raw_value)
        if not cleaned_value:
            continue
        resolved = _resolve_os_by_value(payload_key, cleaned_value)
        if resolved is None:
            errors[payload_key] = f"Não foi possível localizar a referência para {payload_key.replace('_', ' ')}."
            continue
        setattr(financeiro, model_field, resolved)

    if "metodo" in payload:
        raw_method = _clean_text(payload.get("metodo"))
        if not raw_method:
            financeiro.metodo_cadastro = None
        else:
            method = _resolve_active_method(raw_method)
            if method is None:
                errors["metodo"] = "Selecione ou cadastre um método ativo."
            else:
                financeiro.metodo_cadastro = method

    if "responsavel" in payload:
        person = _resolve_active_person(payload.get("responsavel"), "responsavel")
        if person is None and will_not_participate and not _clean_text(payload.get("responsavel")):
            financeiro.responsavel_cadastro = None
            financeiro.responsavel = "Não informado"
        elif person is None:
            errors["responsavel"] = "Selecione um responsável comercial ativo."
        else:
            financeiro.responsavel_cadastro = person
            financeiro.responsavel = person.nome

    if "coordenador" in payload or "cordenador" in payload:
        person = _resolve_active_person(payload.get("coordenador") or payload.get("cordenador"), "coordenador")
        if person is None:
            errors["coordenador"] = "Selecione um coordenador ativo."
        else:
            financeiro.coordenador_cadastro = person

    if any(key in payload for key in ("follow_up", "cliente", "unidade", "embarcacao_local")) and "followup_item" not in payload:
        _apply_commercial_bundle_overrides(financeiro, payload)

    if "escopo" in payload:
        financeiro.comentario = _clean_text(payload.get("escopo"))

    followup_item = payload.get("followup_item")
    if followup_item:
        _store_followup_item(financeiro, followup_item)

    history_entry = payload.get("history_entry")
    if history_entry:
        _append_history_to_bundle(financeiro, history_entry)

    return errors


@login_required(login_url="/login/")
@commercial_preview_required
def comercial_home(request):
    payload = _build_bootstrap_payload()
    context = {
        "commercial_bootstrap": payload,
        "total_propostas": len(payload.get("proposals", [])),
        "proximo_numero_proposta": payload.get("metadata", {}).get("nextProposalNumber", 1),
    }
    return render(request, "comercial/propostas.html", context)


@login_required(login_url="/login/")
@commercial_preview_required
@require_GET
def comercial_exportar_excel(request):
    try:
        import pandas as pd
    except ImportError:
        return JsonResponse(
            {
                "success": False,
                "message": "A exportação em Excel requer pandas e openpyxl instalados no ambiente.",
            },
            status=500,
        )

    payload = _build_bootstrap_payload()
    filtered_proposals = _filter_serialized_proposals_for_home(
        payload.get("proposals", []),
        search=request.GET.get("search", ""),
        numero=request.GET.get("numero", ""),
        status=request.GET.get("status", ""),
        natureza=request.GET.get("natureza", ""),
        status_proposta=request.GET.get("status_proposta", ""),
        tipo_operacao=request.GET.get("tipo_operacao", ""),
        responsavel=request.GET.get("responsavel", ""),
        cliente=request.GET.get("cliente", ""),
        unidade=request.GET.get("unidade", ""),
        uf=request.GET.get("uf", ""),
        segmento_cliente=request.GET.get("segmento_cliente", ""),
        fonte_lead=request.GET.get("fonte_lead", ""),
        heat_map=request.GET.get("heat_map", ""),
        motivo_perda=request.GET.get("motivo_perda", ""),
        prazo=request.GET.get("prazo", ""),
        kpi_filter=request.GET.get("kpi_filter", ""),
        focused_stage=request.GET.get("focused_stage", ""),
    )

    rows = _build_comercial_export_rows(filtered_proposals)
    df = pd.DataFrame(rows or [{"Nenhum resultado": "Nenhuma proposta encontrada para os filtros selecionados."}])

    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Propostas Comerciais")
    output.seek(0)

    response = HttpResponse(
        output.read(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    response["Content-Disposition"] = 'attachment; filename="propostas_comerciais_filtradas.xlsx"'
    return response


@login_required(login_url="/login/")
@commercial_preview_required
@require_POST
@transaction.atomic
def comercial_criar_proposta(request):
    payload = _read_request_json(request)
    will_not_participate = _proposal_will_not_participate(payload)
    financeiro, errors = _create_financeiro_from_payload(payload)
    campos, campo_errors = _parse_financeiro_campos_payload(payload)
    critical_answers, critical_errors, critical_comment = _parse_critical_analysis_payload(payload)
    if campo_errors and not will_not_participate:
        errors = {**errors, **campo_errors} if errors else campo_errors
    if critical_errors:
        errors = {**errors, **critical_errors} if errors else critical_errors
    if errors:
        return JsonResponse(
            {
                "success": False,
                "message": "Não foi possível criar a proposta com os dados enviados.",
                "errors": errors,
            },
            status=400,
        )

    try:
        financeiro.save()
        _sync_financeiro_campos(financeiro, campos)
        _save_critical_analysis(financeiro, critical_answers or {}, critical_comment or "", request.user)
    except IntegrityError:
        return JsonResponse(
            {
                "success": False,
                "message": "Não foi possível gerar o número da proposta. Tente novamente.",
                "errors": {"proposta": "Não foi possível gerar o número da proposta. Tente novamente."},
            },
            status=409,
        )

    return JsonResponse(
        {
            "success": True,
            "message": "Proposta criada com sucesso.",
            "proposal": _serialize_financeiro(financeiro),
            "nextProposalNumber": _get_next_proposal_number(),
        }
    )


@login_required(login_url="/login/")
@commercial_preview_required
@require_POST
def comercial_criar_cliente(request):
    payload = _read_request_json(request)
    nome = _clean_text(payload.get("nome"))

    if not nome:
        return JsonResponse(
            {"success": False, "message": "Informe o nome do cliente.", "errors": {"nome": "Informe o nome do cliente."}},
            status=400,
        )

    existing = Cliente.objects.filter(nome__iexact=nome).first()
    if existing:
        return JsonResponse(
            {
                "success": False,
                "message": "Ja existe um cliente cadastrado com este nome.",
                "errors": {"nome": "Ja existe um cliente cadastrado com este nome."},
            },
            status=409,
        )

    try:
        cliente = Cliente.objects.create(nome=nome)
    except (ValidationError, IntegrityError):
        return JsonResponse(
            {
                "success": False,
                "message": "Ja existe um cliente cadastrado com este nome.",
                "errors": {"nome": "Ja existe um cliente cadastrado com este nome."},
            },
            status=409,
        )
    return JsonResponse(
        {
            "success": True,
            "message": "Cliente cadastrado com sucesso.",
            "cliente": {"value": cliente.nome, "label": cliente.nome},
        }
    )


@login_required(login_url="/login/")
@commercial_preview_required
@require_POST
def comercial_criar_unidade(request):
    payload = _read_request_json(request)
    nome = _clean_text(payload.get("nome"))

    if not nome:
        return JsonResponse(
            {"success": False, "message": "Informe o nome da unidade.", "errors": {"nome": "Informe o nome da unidade."}},
            status=400,
        )

    existing = Unidade.objects.filter(nome__iexact=nome).first()
    if existing:
        return JsonResponse(
            {
                "success": False,
                "message": "Ja existe uma unidade cadastrada com este nome.",
                "errors": {"nome": "Ja existe uma unidade cadastrada com este nome."},
            },
            status=409,
        )

    try:
        unidade = Unidade.objects.create(nome=nome)
    except (ValidationError, IntegrityError):
        return JsonResponse(
            {
                "success": False,
                "message": "Ja existe uma unidade cadastrada com este nome.",
                "errors": {"nome": "Ja existe uma unidade cadastrada com este nome."},
            },
            status=409,
        )
    return JsonResponse(
        {
            "success": True,
            "message": "Unidade cadastrada com sucesso.",
            "unidade": {"value": unidade.nome, "label": unidade.nome},
        }
    )


@login_required(login_url="/login/")
@commercial_preview_required
@require_POST
def comercial_criar_metodo(request):
    payload = _read_request_json(request)
    nome = _clean_text(payload.get("nome"))

    if not nome:
        return JsonResponse(
            {"success": False, "message": "Informe o nome do método.", "errors": {"nome": "Informe o nome do método."}},
            status=400,
        )

    if MetodoOperacional.objects.filter(nome__iexact=nome).exists():
        return JsonResponse(
            {
                "success": False,
                "message": "Já existe um método cadastrado com este nome.",
                "errors": {"nome": "Já existe um método cadastrado com este nome."},
            },
            status=409,
        )

    try:
        metodo = MetodoOperacional.objects.create(nome=nome)
    except (ValidationError, IntegrityError):
        return JsonResponse(
            {
                "success": False,
                "message": "Já existe um método cadastrado com este nome.",
                "errors": {"nome": "Já existe um método cadastrado com este nome."},
            },
            status=409,
        )

    return JsonResponse(
        {
            "success": True,
            "message": "Método cadastrado com sucesso.",
            "metodo": {"value": metodo.nome, "label": metodo.nome},
        }
    )


def _create_commercial_catalog_entry(model_class, nome, *, kind):
    if not nome:
        return None, JsonResponse(
            {"success": False, "message": f"Informe o nome do {kind}.", "errors": {"nome": f"Informe o nome do {kind}."}},
            status=400,
        )
    if model_class.objects.filter(nome__iexact=nome).exists():
        return None, JsonResponse(
            {"success": False, "message": f"Já existe um {kind} cadastrado com este nome.", "errors": {"nome": f"Já existe um {kind} cadastrado com este nome."}},
            status=409,
        )
    try:
        return model_class.objects.create(nome=nome), None
    except (ValidationError, IntegrityError):
        return None, JsonResponse(
            {"success": False, "message": f"Já existe um {kind} cadastrado com este nome.", "errors": {"nome": f"Já existe um {kind} cadastrado com este nome."}},
            status=409,
        )


@login_required(login_url="/login/")
@commercial_preview_required
@require_POST
def comercial_criar_servico(request):
    servico, error_response = _create_commercial_catalog_entry(
        ServicoComercial, _clean_text(_read_request_json(request).get("nome")), kind="serviço"
    )
    if error_response:
        return error_response
    return JsonResponse({"success": True, "message": "Serviço cadastrado com sucesso.", "servico": {"value": servico.nome, "label": servico.nome}})


@login_required(login_url="/login/")
@commercial_preview_required
@require_POST
def comercial_criar_item_equipamento(request):
    item, error_response = _create_commercial_catalog_entry(
        ItemEquipamentoComercial, _clean_text(_read_request_json(request).get("nome")), kind="item ou equipamento"
    )
    if error_response:
        return error_response
    return JsonResponse({"success": True, "message": "Item/equipamento cadastrado com sucesso.", "item": {"value": item.nome, "label": item.nome, "group": "Itens cadastrados"}})


@login_required(login_url="/login/")
@commercial_preview_required
@require_POST
def comercial_criar_segmento(request):
    segmento, error_response = _create_commercial_catalog_entry(
        SegmentoClienteComercial, _clean_text(_read_request_json(request).get("nome")), kind="segmento"
    )
    if error_response:
        return error_response
    return JsonResponse({"success": True, "message": "Segmento cadastrado com sucesso.", "segmento": {"value": segmento.nome, "label": segmento.nome}})


@login_required(login_url="/login/")
@commercial_preview_required
@require_GET
def comercial_agenda_followups(request):
    all_items, _responsible_names = _collect_current_user_followup_items(request.user)
    search = _clean_text(request.GET.get("q"))
    status = _clean_text(request.GET.get("status")) or "Todos"
    start_date = _parse_iso_query_date(request.GET.get("start_date"))
    end_date = _parse_iso_query_date(request.GET.get("end_date"))

    filtered_items = _filter_agenda_items(
        all_items,
        search=search,
        responsavel="Todos",
        status=status,
        start_date=start_date,
        end_date=end_date,
    )

    return JsonResponse(
        {
            "success": True,
            "can_view_all": _can_view_all_commercial_followups(request.user),
            "summary": _build_followup_agenda_summary(filtered_items, today=timezone.localdate()),
            "items": filtered_items,
            "calendar_days": _build_calendar_days(filtered_items),
            "responsavel_options": ["Todos"],
            "status_options": _agenda_status_options(all_items),
            "total_all": len(all_items),
            "total_filtered": len(filtered_items),
            "today": timezone.localdate().isoformat(),
        }
    )


@login_required(login_url="/login/")
@commercial_preview_required
@require_GET
def comercial_catalogos(request):
    """Expose the persisted commercial catalogues used by proposal forms."""
    return JsonResponse({"success": True, "metadata": _build_metadata()})


@login_required(login_url="/login/")
@commercial_preview_required
@require_GET
def comercial_meus_followups(request):
    """Renderiza os acompanhamentos atribuídos ao responsável do usuário logado."""
    all_items, responsible_names = _collect_current_user_followup_items(request.user)
    search = _clean_text(request.GET.get("q"))
    status = _clean_text(request.GET.get("status")) or "Todos"
    start_date = _parse_iso_query_date(request.GET.get("start_date"))
    end_date = _parse_iso_query_date(request.GET.get("end_date"))
    ordering = _clean_text(request.GET.get("ordem")) or "proximos"

    filtered_items = _filter_agenda_items(
        all_items,
        search=search,
        responsavel="Todos",
        status=status,
        start_date=start_date,
        end_date=end_date,
    )
    filtered_items.sort(
        key=lambda item: (item.get("data") or "9999-12-31", item.get("hora") or "23:59"),
        reverse=ordering == "recentes",
    )

    today = timezone.localdate()
    tomorrow = today + timedelta(days=1)
    for item in filtered_items:
        item_date = _parse_iso_query_date(item.get("data"))
        if item_date == today:
            item["group_label"] = f"Hoje - {_format_date_br(today)}"
        elif item_date == tomorrow:
            item["group_label"] = f"Amanhã - {_format_date_br(tomorrow)}"
        else:
            item["group_label"] = "Próximos dias"

    paginator = Paginator(filtered_items, 12)
    page_obj = paginator.get_page(request.GET.get("page"))
    context = {
        "followups": page_obj.object_list,
        "page_obj": page_obj,
        "total_followups": len(filtered_items),
        "status_options": _agenda_status_options(all_items),
        "filters": {
            "q": search,
            "status": status,
            "start_date": start_date.isoformat() if start_date else "",
            "end_date": end_date.isoformat() if end_date else "",
            "ordem": ordering,
        },
        "responsible_names": responsible_names,
        "has_responsible_profile": bool(responsible_names),
    }
    return render(request, "comercial/meus_followups.html", context)


@login_required(login_url="/login/")
@commercial_preview_required
@require_POST
def comercial_criar_followup(request):
    payload = _read_request_json(request)
    proposta_id = _parse_proposal_number(payload.get("proposta_id"))
    proposta = get_object_or_404(Financeiro, pk=proposta_id)

    data_followup = _parse_date_input(payload.get("data"))
    hora = _clean_text(payload.get("hora")) or "09:00"
    responsavel = _clean_text(payload.get("responsavel")) or _clean_text(proposta.responsavel)
    status = _clean_text(payload.get("status")) or FOLLOWUP_STATUSES[0]
    titulo = _clean_text(payload.get("titulo"))
    comentario = _clean_text(payload.get("comentario"))
    tipo_contato = _clean_text(payload.get("tipo_contato")) or "Acompanhamento comercial"

    errors = {}
    if not data_followup:
        errors["data"] = "Informe a data do acompanhamento."
    if not titulo:
        errors["titulo"] = "Informe o assunto do acompanhamento."
    if not responsavel:
        errors["responsavel"] = "Informe o responsável."
    if errors:
        return JsonResponse(
            {
                "success": False,
                "message": "Não foi possível criar o acompanhamento com os dados enviados.",
                "errors": errors,
            },
            status=400,
        )

    followup_item = {
        "data": data_followup.strftime("%d/%m/%Y"),
        "hora": hora,
        "responsavel": responsavel,
        "tipoContato": tipo_contato,
        "comentario": comentario or titulo,
        "proximaAcao": titulo,
        "dataProximaAcao": data_followup.strftime("%d/%m/%Y"),
        "status": status,
    }

    _store_followup_item(proposta, followup_item)
    _append_history_to_bundle(
        proposta,
        {
            "usuario": _clean_text(request.user.get_username()) or responsavel,
            "acao": "Acompanhamento registrado",
            "detalhe": titulo,
        },
    )
    proposta.save(update_fields=["follow_up"])

    return JsonResponse(
        {
            "success": True,
            "message": "Acompanhamento criado com sucesso.",
            "proposal": _serialize_financeiro(proposta),
            "followup": _serialize_agenda_followup(proposta, followup_item, index=1),
        }
    )


@login_required(login_url="/login/")
@commercial_preview_required
@require_GET
def comercial_detalhe_proposta(request, proposta_id):
    proposta = get_object_or_404(
        Financeiro.objects.select_related(
            "cliente__Cliente",
            "cliente__Unidade",
            "unidade__Cliente",
            "unidade__Unidade",
            "tipo_operacao",
            "metodo",
            "metodo_cadastro",
            "cordenador",
            "analise_critica_oportunidade",
        ).prefetch_related("campos", "anexos__enviado_por"),
        pk=proposta_id,
    )
    return JsonResponse({"success": True, "proposal": _serialize_financeiro(proposta)})


PROPOSTA_ANEXO_EXTENSOES_PERMITIDAS = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".csv", ".txt", ".png", ".jpg", ".jpeg",
}
PROPOSTA_ANEXO_TAMANHO_MAXIMO = 20 * 1024 * 1024


@login_required(login_url="/login/")
@commercial_preview_required
@require_GET
def comercial_listar_anexos_proposta(request, proposta_id):
    proposta = get_object_or_404(Financeiro, pk=proposta_id)
    anexos = proposta.anexos.select_related("enviado_por").all()
    return JsonResponse({
        "success": True,
        "anexos": [_serialize_proposta_anexo(anexo) for anexo in anexos],
    })


@login_required(login_url="/login/")
@commercial_preview_required
@require_POST
@transaction.atomic
def comercial_enviar_anexos_proposta(request, proposta_id):
    proposta = get_object_or_404(Financeiro, pk=proposta_id)
    arquivos = request.FILES.getlist("arquivos") or ([request.FILES["arquivo"]] if request.FILES.get("arquivo") else [])
    if not arquivos:
        return JsonResponse({"success": False, "message": "Selecione ao menos um documento."}, status=400)

    errors = []
    for arquivo in arquivos:
        nome_original = os.path.basename(str(getattr(arquivo, "name", "") or ""))
        extensao = os.path.splitext(nome_original)[1].lower()
        if extensao not in PROPOSTA_ANEXO_EXTENSOES_PERMITIDAS:
            errors.append(f"{nome_original or 'Arquivo'} possui um formato não permitido.")
        elif arquivo.size > PROPOSTA_ANEXO_TAMANHO_MAXIMO:
            errors.append(f"{nome_original} ultrapassa o limite de 20 MB.")

    if errors:
        return JsonResponse({"success": False, "message": "Não foi possível enviar os documentos.", "errors": errors}, status=400)

    anexos = []
    for arquivo in arquivos:
        anexo = AnexoPropostaComercial.objects.create(
            financeiro=proposta,
            arquivo=arquivo,
            nome_original=os.path.basename(str(getattr(arquivo, "name", "") or "documento")),
            enviado_por=request.user,
        )
        anexos.append(_serialize_proposta_anexo(anexo))

    return JsonResponse({"success": True, "message": "Documento(s) enviado(s) com sucesso.", "anexos": anexos}, status=201)


@login_required(login_url="/login/")
@commercial_preview_required
@require_GET
def comercial_visualizar_anexo_proposta(request, anexo_id):
    anexo = get_object_or_404(AnexoPropostaComercial, pk=anexo_id)
    if not anexo.arquivo:
        return HttpResponse("Arquivo não encontrado.", status=404)

    try:
        return FileResponse(anexo.arquivo.open("rb"), as_attachment=False, filename=anexo.nome_original)
    except OSError:
        return HttpResponse("Arquivo não encontrado.", status=404)


@login_required(login_url="/login/")
@commercial_preview_required
@require_POST
def comercial_excluir_anexo_proposta(request, anexo_id):
    anexo = get_object_or_404(AnexoPropostaComercial, pk=anexo_id)
    try:
        anexo.arquivo.delete(save=False)
    except OSError:
        logger.warning("Não foi possível remover o arquivo do anexo comercial id=%s", anexo.id)
    anexo.delete()
    return JsonResponse({"success": True, "message": "Documento excluído com sucesso."})


def _get_proposal_operation(proposta):
    """Return the commercial operation, including the historical-import override."""
    overrides = _build_commercial_bundle(proposta).get("overrides") or {}
    return _clean_text(overrides.get("tipo_operacao")) or _resolve_tipo_operacao(proposta)


def _is_offshore_proposal(proposta):
    return _get_proposal_operation(proposta).casefold() == "offshore"


def _is_onshore_proposal(proposta):
    """Identify the commercial operation without relying on its display case."""
    operation = _get_proposal_operation(proposta)
    normalized = unicodedata.normalize("NFKD", operation).encode("ascii", "ignore").decode("ascii")
    return normalized.strip().casefold() == "onshore"


def _document_revision_payload(documento, proposta):
    linhas = {kind: [] for kind in ("PROCEDIMENTO", "EQUIPE", "EQUIPAMENTO", "PREMISSA", "OBRIGACAO")}
    for linha in documento.linhas.all():
        linhas[linha.tipo].append({"id": linha.id, "descricao": linha.descricao, "quantidade": linha.quantidade, "ordem": linha.ordem})
    financeiro = [{"id": campo.id, "nome": campo.nome, "descricao": campo.get_nome_display(), "preco_unitario": str(campo.preco_unitario), "quantidade": str(campo.quantidade), "subtotal": str(campo.subtotal)} for campo in proposta.campos.all()]
    imagens = [
        {
            "id": imagem.id,
            "nome": imagem.nome_original,
            "url": imagem.imagem.url,
            "ordem": imagem.ordem,
        }
        for imagem in documento.imagens.all()
        if imagem.imagem
    ]
    return {"id": documento.id, "tipoDocumento": documento.tipo_documento, "revisaoDocumental": f"{documento.revisao_documental:02d}", "status": documento.status, "introducao": documento.introducao_objetivo, "procedimentoTitulo": documento.procedimento_titulo, "conteudo": documento.conteudo_revisao or {}, "confirmacoes": {"procedimento": documento.procedimento_confirmado, "equipe": documento.equipe_confirmada, "equipamentos": documento.equipamentos_confirmados, "premissas": documento.premissas_confirmadas, "obrigacoes": documento.obrigacoes_confirmadas}, "linhas": linhas, "financeiro": financeiro, "imagens": imagens}


def _get_onshore_document_revision(proposta, user, document_type):
    if document_type not in {PropostaDocumentoRevisao.TIPO_PC_ONSHORE, PropostaDocumentoRevisao.TIPO_PT_ONSHORE}:
        raise ValidationError("Selecione um tipo de documento Onshore válido.")
    defaults = {
        "criado_por": user,
        "atualizado_por": user,
        "revisao_documental": 0,
        "conteudo_revisao": {
            "prazo": "",
            "validade_dias": "",
            "referencias": [],
            "sem_referencias": False,
        },
    }
    if document_type == PropostaDocumentoRevisao.TIPO_PT_ONSHORE:
        defaults["conteudo_revisao"] = {
            "resumo_planta": "",
            "metodologia_executiva": "",
            "descricao_histograma": "",
            "referencias": [],
            "sem_referencias": False,
            "prazo_execucao": "",
            "jornada": "",
            "data_emissao": "",
        }
    documento, created = PropostaDocumentoRevisao.objects.get_or_create(
        proposta=proposta,
        numero_revisao=proposta.revisao,
        tipo_documento=document_type,
        defaults=defaults,
    )
    if document_type == PropostaDocumentoRevisao.TIPO_PT_ONSHORE:
        # PT drafts created by the previous generic flow did not have the
        # PT-specific keys. Add only safe defaults; manual fields stay empty.
        content = dict(documento.conteudo_revisao or {})
        histogram_rows = content.get("histograma_mao_obra") or []
        normalized = {
            "resumo_planta": str(content.get("resumo_planta") or "").strip(),
            "metodologia_executiva": str(content.get("metodologia_executiva") or "").strip(),
            "descricao_histograma": str(content.get("descricao_histograma") or "").strip(),
            "referencias": content.get("referencias") if isinstance(content.get("referencias"), list) else [],
            "sem_referencias": bool(content.get("sem_referencias")),
            "prazo_execucao": str(content.get("prazo_execucao") or "").strip(),
            "jornada": str(content.get("jornada") or "").strip(),
            "data_emissao": str(content.get("data_emissao") or "").strip(),
            "data_revisao": str(content.get("data_revisao") or "").strip(),
            "descricao_revisao": str(content.get("descricao_revisao") or "").strip(),
            "histograma_mao_obra": [
                {
                    "funcao": str(row.get("funcao") or "").strip(),
                    "quantidade": str(row.get("quantidade") or "").strip(),
                }
                for row in histogram_rows if isinstance(row, dict)
            ],
            "histograma_equipamentos": [
                str(description or "").strip()
                for description in (content.get("histograma_equipamentos") or [])
                if str(description or "").strip()
            ],
        }
        if content.get("preview_hash"):
            normalized["preview_hash"] = content["preview_hash"]
        if content.get("previewed_em"):
            normalized["previewed_em"] = content["previewed_em"]
        normalized["quadro_revisoes"] = _build_pt_revision_rows(proposta, documento, normalized)
        if content != normalized:
            documento.conteudo_revisao = normalized
            documento.atualizado_por = user
            documento.save(update_fields=("conteudo_revisao", "atualizado_por", "atualizado_em"))
    return documento


def _pt_review_fingerprint(conteudo):
    """Tie PT final emission to the exact revision the user previewed."""
    values = dict(conteudo or {})
    values.pop("preview_hash", None)
    values.pop("previewed_em", None)
    raw_value = json.dumps(values, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(raw_value.encode("utf-8")).hexdigest()


def _pt_revision_number(value):
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _build_pt_revision_rows(proposta, documento, conteudo):
    """Build the PT revision-table history from prior document revisions."""
    current_revision = _pt_revision_number(proposta.revisao)
    rows_by_revision = {}
    previous_documents = PropostaDocumentoRevisao.objects.filter(
        proposta=proposta,
        tipo_documento=PropostaDocumentoRevisao.TIPO_PT_ONSHORE,
        numero_revisao__lt=current_revision,
    ).order_by("numero_revisao")
    for previous in previous_documents:
        previous_content = previous.conteudo_revisao or {}
        for row in previous_content.get("quadro_revisoes") or []:
            revision = _pt_revision_number(row.get("revisao"))
            if revision == _pt_revision_number(previous.numero_revisao):
                rows_by_revision[revision] = {
                    "revisao": f"{revision:02d}",
                    "data": str(row.get("data") or ""),
                    "descricao": str(row.get("descricao") or ""),
                }
                break
        else:
            revision = _pt_revision_number(previous.numero_revisao)
            rows_by_revision[revision] = {
                "revisao": f"{revision:02d}",
                "data": str(previous_content.get("data_revisao") or previous_content.get("data_emissao") or ""),
                "descricao": str(previous_content.get("descricao_revisao") or ("Emissão Inicial." if revision == 0 else "")),
            }

    current_date = str(conteudo.get("data_revisao") or "")
    current_description = str(conteudo.get("descricao_revisao") or "")
    if current_revision == 0:
        current_date = current_date or str(conteudo.get("data_emissao") or "")
        current_description = current_description or "Emissão Inicial."
    rows_by_revision[current_revision] = {
        "revisao": f"{current_revision:02d}",
        "data": current_date,
        "descricao": current_description,
    }
    return [rows_by_revision[number] for number in sorted(rows_by_revision)]


def _sync_pc_onshore_review_quantities(proposta, conteudo):
    """Persist the PPU quantities so the proposal and its PDF never diverge."""
    selections = (conteudo or {}).get("itens_financeiros") or {}
    if not isinstance(selections, dict):
        raise ValidationError("Os itens financeiros da PPU são inválidos.")

    campos = {str(campo.id): campo for campo in proposta.campos.all()}
    for campo_id, selection in selections.items():
        if not isinstance(selection, dict) or selection.get("incluir") is False:
            continue
        campo = campos.get(str(campo_id))
        if campo is None:
            raise ValidationError("Um dos itens financeiros selecionados não pertence a esta proposta.")
        try:
            quantity = Decimal(str(selection.get("quantidade") or ""))
        except (InvalidOperation, TypeError, ValueError) as error:
            raise ValidationError("Informe uma quantidade inteira válida para cada item selecionado.") from error
        if quantity <= 0 or quantity != quantity.to_integral_value():
            raise ValidationError("A quantidade dos itens da PPU deve ser um número inteiro maior que zero.")
        if campo.quantidade != quantity:
            campo.quantidade = quantity
            campo.save(update_fields=("quantidade", "subtotal"))

    # Keep the commercial revenue aligned with the same item values emitted in the PPU.
    total_items = sum((campo.subtotal or Decimal("0")) for campo in proposta.campos.all())
    if proposta.estimativo_receita != total_items:
        proposta.estimativo_receita = total_items
        proposta.save(update_fields=("estimativo_receita",))


def _build_offshore_contextual_draft(proposta):
    """Create a safe first draft from the actual service and operating unit."""
    proposal_data = _serialize_financeiro(proposta)
    service = _clean_text(proposal_data.get("servico") or proposal_data.get("escopo"))
    unit = _clean_text(proposal_data.get("unidade"))
    service_label = service or "serviço descrito nesta proposta"
    unit_label = unit or "unidade informada na proposta"
    return {
        "introducao": (
            f"Esta proposta contempla a execução de {service_label} na unidade {unit_label}. "
            "As atividades serão conduzidas conforme os requisitos operacionais, de segurança e do cliente."
        ),
        "procedimentoTitulo": f"PROCEDIMENTO DE EXECUÇÃO — {service_label.upper()}",
    }


def _get_document_revision(proposta, user):
    documento, created = PropostaDocumentoRevisao.objects.get_or_create(
        proposta=proposta,
        numero_revisao=proposta.revisao,
        tipo_documento=PropostaDocumentoRevisao.TIPO_OFFSHORE,
        defaults={"criado_por": user, "atualizado_por": user},
    )
    draft = load_offshore_template_draft()
    if created or not documento.linhas.exists() or not documento.introducao_objetivo or documento.introducao_objetivo == draft["introducao"] or not documento.procedimento_titulo or documento.procedimento_titulo == draft["procedimentoTitulo"]:
        contextual_draft = _build_offshore_contextual_draft(proposta)
        update_fields = []
        if not documento.introducao_objetivo or documento.introducao_objetivo == draft["introducao"]:
            documento.introducao_objetivo = contextual_draft["introducao"]
            update_fields.append("introducao_objetivo")
        if not documento.procedimento_titulo or documento.procedimento_titulo == draft["procedimentoTitulo"]:
            documento.procedimento_titulo = contextual_draft["procedimentoTitulo"]
            update_fields.append("procedimento_titulo")
        if update_fields:
            documento.save(update_fields=(*update_fields, "atualizado_em"))
        if not documento.linhas.exists():
            for kind, rows in draft["linhas"].items():
                for order, row in enumerate(rows, start=1):
                    PropostaDocumentoLinha.objects.create(documento=documento, tipo=kind, ordem=order, descricao=row["descricao"], quantidade=row.get("quantidade", ""))
    return documento


@login_required(login_url="/login/")
@commercial_preview_required
@require_GET
def comercial_revisao_documento_proposta(request, proposta_id):
    proposta = get_object_or_404(Financeiro.objects.select_related("tipo_operacao").prefetch_related("campos", "documentos_revisados__linhas"), pk=proposta_id)
    if _is_onshore_proposal(proposta):
        document_type = request.GET.get("document_type", "").strip()
        if document_type:
            try:
                documento = _get_onshore_document_revision(proposta, request.user, document_type)
            except ValidationError as error:
                return JsonResponse({"success": False, "message": error.messages[0]}, status=400)
            return JsonResponse({"success": True, "revisao": _document_revision_payload(documento, proposta), "proposta": _serialize_financeiro(proposta)})
        # Onshore always starts with an explicit PC/PT decision. Returning this
        # response prevents the browser from falling back to a direct download.
        return JsonResponse({
            "success": True,
            "document_selection_required": True,
            "proposta": _serialize_financeiro(proposta),
            "document_types": (
                {"value": "PC_ONSHORE", "label": "Documento PC"},
                {"value": "PT_ONSHORE", "label": "Documento PT"},
            ),
        })
    if not _is_offshore_proposal(proposta):
        return JsonResponse({"success": False, "message": "A revisão documental controlada está disponível apenas para propostas Offshore."}, status=400)
    documento = _get_document_revision(proposta, request.user)
    return JsonResponse({"success": True, "revisao": _document_revision_payload(documento, proposta), "proposta": _serialize_financeiro(proposta)})


DOCUMENT_REVIEW_IMAGE_MAX_SIZE = 10 * 1024 * 1024
DOCUMENT_REVIEW_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png"}


def _validate_document_review_images(images):
    """Validate images before they become part of an official Offshore document."""
    if not images:
        raise ValidationError("Selecione ao menos uma imagem para enviar.")

    errors = []
    for image_file in images:
        extension = os.path.splitext(image_file.name or "")[1].lower()
        if extension not in DOCUMENT_REVIEW_IMAGE_EXTENSIONS:
            errors.append(f"{image_file.name}: envie somente imagens PNG ou JPEG.")
            continue
        if image_file.size > DOCUMENT_REVIEW_IMAGE_MAX_SIZE:
            errors.append(f"{image_file.name}: a imagem deve ter no maximo 10 MB.")
            continue
        try:
            from PIL import Image

            uploaded_image = Image.open(image_file)
            uploaded_image.verify()
            image_file.seek(0)
        except Exception:
            errors.append(f"{image_file.name}: o arquivo nao e uma imagem valida.")
    if errors:
        raise ValidationError(errors)


@login_required(login_url="/login/")
@commercial_preview_required
@require_POST
@transaction.atomic
def comercial_enviar_imagens_revisao_documento(request, proposta_id):
    proposta = get_object_or_404(Financeiro.objects.select_related("tipo_operacao").prefetch_related("campos"), pk=proposta_id)
    document_type = request.POST.get("document_type", PropostaDocumentoRevisao.TIPO_OFFSHORE).strip()
    allowed_types = {
        PropostaDocumentoRevisao.TIPO_OFFSHORE,
        PropostaDocumentoRevisao.TIPO_PC_ONSHORE,
    }
    if document_type not in allowed_types:
        return JsonResponse({"success": False, "message": "Imagens estao disponiveis somente para as propostas comerciais Offshore e Onshore."}, status=400)
    if document_type == PropostaDocumentoRevisao.TIPO_OFFSHORE and not _is_offshore_proposal(proposta):
        return JsonResponse({"success": False, "message": "A revisao selecionada nao pertence a uma proposta Offshore."}, status=400)
    if document_type == PropostaDocumentoRevisao.TIPO_PC_ONSHORE and not _is_onshore_proposal(proposta):
        return JsonResponse({"success": False, "message": "A revisao selecionada nao pertence a uma proposta Onshore."}, status=400)

    images = request.FILES.getlist("imagens")
    try:
        _validate_document_review_images(images)
    except ValidationError as error:
        return JsonResponse({"success": False, "message": error.messages[0], "errors": error.messages}, status=400)

    documento = (
        _get_document_revision(proposta, request.user)
        if document_type == PropostaDocumentoRevisao.TIPO_OFFSHORE
        else _get_onshore_document_revision(proposta, request.user, document_type)
    )
    next_order = (documento.imagens.aggregate(max_order=Max("ordem")).get("max_order") or 0) + 1
    for image_file in images:
        PropostaDocumentoImagem.objects.create(
            documento=documento,
            imagem=image_file,
            nome_original=os.path.basename(image_file.name or "imagem"),
            ordem=next_order,
            enviado_por=request.user,
        )
        next_order += 1
    documento.atualizado_por = request.user
    documento.save(update_fields=("atualizado_por", "atualizado_em"))
    documento.refresh_from_db()
    return JsonResponse({"success": True, "message": "Imagem(ns) adicionada(s) a introducao.", "imagens": _document_revision_payload(documento, proposta)["imagens"]}, status=201)


@login_required(login_url="/login/")
@commercial_preview_required
@require_POST
@transaction.atomic
def comercial_excluir_imagem_revisao_documento(request, proposta_id, imagem_id):
    imagem = get_object_or_404(
        PropostaDocumentoImagem.objects.select_related("documento", "documento__proposta", "documento__proposta__tipo_operacao"),
        pk=imagem_id,
        documento__proposta_id=proposta_id,
        documento__tipo_documento__in=(
            PropostaDocumentoRevisao.TIPO_OFFSHORE,
            PropostaDocumentoRevisao.TIPO_PC_ONSHORE,
        ),
    )
    proposta = imagem.documento.proposta
    if imagem.documento.tipo_documento == PropostaDocumentoRevisao.TIPO_OFFSHORE and not _is_offshore_proposal(proposta):
        return JsonResponse({"success": False, "message": "Imagem de revisao indisponivel para esta proposta."}, status=400)
    if imagem.documento.tipo_documento == PropostaDocumentoRevisao.TIPO_PC_ONSHORE and not _is_onshore_proposal(proposta):
        return JsonResponse({"success": False, "message": "Imagem de revisao indisponivel para esta proposta."}, status=400)
    documento = imagem.documento
    try:
        imagem.imagem.delete(save=False)
    except OSError:
        logger.warning("Nao foi possivel remover o arquivo da imagem documental id=%s", imagem.id)
    imagem.delete()
    documento.atualizado_por = request.user
    documento.save(update_fields=("atualizado_por", "atualizado_em"))
    return JsonResponse({"success": True, "message": "Imagem removida da introducao.", "imagens": _document_revision_payload(documento, proposta)["imagens"]})


def _parse_offshore_financial_decimal(value, label, *, allow_zero=False):
    """Parse the JSON values used by the review table without inventing amounts."""
    raw_value = str(value if value is not None else "").strip().replace("R$", "").replace(" ", "")
    if "," in raw_value:
        raw_value = raw_value.replace(".", "").replace(",", ".")
    try:
        parsed = Decimal(raw_value)
    except (InvalidOperation, ValueError):
        raise ValidationError(f"Informe um {label.lower()} v\u00e1lido.")
    if parsed < 0 or (not allow_zero and parsed == 0):
        raise ValidationError(f"Informe um {label.lower()} maior que zero.")
    return parsed


def _sync_offshore_review_financial_items(proposta, raw_items):
    """Keep the commercial items and the Offshore document review in sync."""
    if not isinstance(raw_items, list):
        raise ValidationError("Os itens financeiros devem ser enviados em uma lista.")

    choices = {value for value, _label in FinanceiroCampo._meta.get_field("nome").choices}
    existing_items = {item.id: item for item in proposta.campos.all()}
    normalized_items = []
    retained_ids = set()

    for raw_item in raw_items:
        if not isinstance(raw_item, dict):
            raise ValidationError("Um dos itens financeiros est\u00e1 inv\u00e1lido.")
        name = str(raw_item.get("nome") or "").strip()
        if name not in choices:
            raise ValidationError("Selecione um item ou equipamento v\u00e1lido.")
        item_id = raw_item.get("id")
        try:
            item_id = int(item_id) if item_id not in (None, "") else None
        except (TypeError, ValueError):
            raise ValidationError("Um dos itens financeiros possui identifica\u00e7\u00e3o inv\u00e1lida.")
        if item_id is not None:
            if item_id not in existing_items:
                raise ValidationError("Um dos itens financeiros n\u00e3o pertence a esta proposta.")
            if item_id in retained_ids:
                raise ValidationError("Um item financeiro foi informado mais de uma vez.")
            retained_ids.add(item_id)
        quantity = _parse_offshore_financial_decimal(raw_item.get("quantidade"), "quantidade")
        if quantity != quantity.to_integral_value():
            raise ValidationError("A quantidade de cada item deve ser um numero inteiro.")
        normalized_items.append({
            "id": item_id,
            "nome": name,
            "preco_unitario": _parse_offshore_financial_decimal(raw_item.get("preco_unitario"), "pre\u00e7o unit\u00e1rio", allow_zero=True),
            "quantidade": quantity,
        })

    for item in existing_items.values():
        if item.id not in retained_ids:
            item.delete()

    total = Decimal("0.00")
    for item_data in normalized_items:
        item = existing_items.get(item_data["id"]) if item_data["id"] else FinanceiroCampo(financeiro=proposta)
        item.nome = item_data["nome"]
        item.preco_unitario = item_data["preco_unitario"]
        item.quantidade = item_data["quantidade"]
        item.save()
        total += item.subtotal or Decimal("0.00")

    proposta.estimativo_receita = total
    proposta.save(update_fields=["estimativo_receita"])
    getattr(proposta, "_prefetched_objects_cache", {}).pop("campos", None)


@login_required(login_url="/login/")
@commercial_preview_required
@require_POST
@transaction.atomic
def comercial_salvar_revisao_documento_proposta(request, proposta_id):
    proposta = get_object_or_404(Financeiro.objects.select_related("tipo_operacao").prefetch_related("campos"), pk=proposta_id)
    payload = _read_request_json(request)
    if _is_onshore_proposal(proposta):
        document_type = str(payload.get("document_type") or "")
        try:
            documento = _get_onshore_document_revision(proposta, request.user, document_type)
        except ValidationError as error:
            return JsonResponse({"success": False, "message": error.messages[0]}, status=400)
        documento.introducao_objetivo = str(payload.get("introducao") or "").strip()
        documento.procedimento_titulo = str(payload.get("procedimentoTitulo") or "").strip()
        if isinstance(payload.get("conteudo"), dict):
            conteudo = dict(payload["conteudo"])
            if document_type == PropostaDocumentoRevisao.TIPO_PT_ONSHORE:
                raw_references = conteudo.get("referencias") or []
                if not isinstance(raw_references, list):
                    return JsonResponse({"success": False, "message": "As referencias da PT devem ser enviadas em lista."}, status=400)
                conteudo = {
                    "resumo_planta": str(conteudo.get("resumo_planta") or "").strip(),
                    "metodologia_executiva": str(conteudo.get("metodologia_executiva") or "").strip(),
                    "descricao_histograma": str(conteudo.get("descricao_histograma") or "").strip(),
                    "referencias": [str(value).strip() for value in raw_references if str(value).strip()],
                    "sem_referencias": bool(conteudo.get("sem_referencias")),
                    "prazo_execucao": str(conteudo.get("prazo_execucao") or "").strip(),
                    "jornada": str(conteudo.get("jornada") or "").strip(),
                    "data_emissao": str(conteudo.get("data_emissao") or "").strip(),
                    "data_revisao": str(conteudo.get("data_revisao") or "").strip(),
                    "descricao_revisao": str(conteudo.get("descricao_revisao") or "").strip(),
                    "histograma_mao_obra": [
                        {
                            "funcao": str(row.get("funcao") or "").strip(),
                            "quantidade": str(row.get("quantidade") or "").strip(),
                        }
                        for row in (conteudo.get("histograma_mao_obra") or []) if isinstance(row, dict)
                    ],
                    "histograma_equipamentos": [
                        str(description or "").strip()
                        for description in (conteudo.get("histograma_equipamentos") or [])
                        if str(description or "").strip()
                    ],
                }
                conteudo["quadro_revisoes"] = _build_pt_revision_rows(proposta, documento, conteudo)
            documento.conteudo_revisao = conteudo
            if document_type == PropostaDocumentoRevisao.TIPO_PC_ONSHORE:
                try:
                    _sync_pc_onshore_review_quantities(proposta, documento.conteudo_revisao)
                except ValidationError as error:
                    return JsonResponse({"success": False, "message": error.messages[0]}, status=400)
        documento.atualizado_por = request.user
        documento.save()
        documento.linhas.all().delete()
        for kind, rows in (payload.get("linhas") or {}).items():
            if kind not in {"PROCEDIMENTO", "EQUIPE", "EQUIPAMENTO", "PREMISSA", "OBRIGACAO"}:
                continue
            for order, row in enumerate(rows or [], start=1):
                descricao = str((row or {}).get("descricao") or "").strip()
                if descricao:
                    PropostaDocumentoLinha.objects.create(
                        documento=documento,
                        tipo=kind,
                        ordem=order,
                        descricao=descricao,
                        quantidade=str((row or {}).get("quantidade") or "").strip(),
                    )
        return JsonResponse({"success": True, "message": "Rascunho documental salvo.", "revisao": _document_revision_payload(documento, proposta)})
    if not _is_offshore_proposal(proposta):
        return JsonResponse({"success": False, "message": "A revisão documental está disponível apenas para Offshore."}, status=400)
    payload = _read_request_json(request)
    documento = _get_document_revision(proposta, request.user)
    if "itens_financeiros" in payload:
        try:
            _sync_offshore_review_financial_items(proposta, payload.get("itens_financeiros"))
        except ValidationError as error:
            return JsonResponse({"success": False, "message": error.messages[0]}, status=400)
    documento.introducao_objetivo = str(payload.get("introducao") or "").strip()
    documento.procedimento_titulo = str(payload.get("procedimentoTitulo") or "").strip()
    confirms = payload.get("confirmacoes") or {}
    for field, key in (("procedimento_confirmado", "procedimento"), ("equipe_confirmada", "equipe"), ("equipamentos_confirmados", "equipamentos"), ("premissas_confirmadas", "premissas"), ("obrigacoes_confirmadas", "obrigacoes")):
        setattr(documento, field, bool(confirms.get(key)))
    documento.atualizado_por = request.user
    documento.save()
    documento.linhas.all().delete()
    for kind, rows in (payload.get("linhas") or {}).items():
        if kind not in {"PROCEDIMENTO", "EQUIPE", "EQUIPAMENTO", "PREMISSA", "OBRIGACAO"}:
            continue
        for order, row in enumerate(rows or [], start=1):
            descricao = str((row or {}).get("descricao") or "").strip()
            if descricao:
                PropostaDocumentoLinha.objects.create(documento=documento, tipo=kind, ordem=order, descricao=descricao, quantidade=str((row or {}).get("quantidade") or "").strip())
    documento.refresh_from_db()
    return JsonResponse({"success": True, "message": "Revisão documental salva.", "revisao": _document_revision_payload(documento, proposta)})


def _render_pdf_preview_pages(pdf_content):
    """Render the temporary PDF to images so the browser cannot expose native PDF actions."""
    try:
        import fitz

        document = fitz.open(stream=pdf_content, filetype="pdf")
        pages = []
        for page_number, page in enumerate(document, start=1):
            pixmap = page.get_pixmap(matrix=fitz.Matrix(1.25, 1.25), alpha=False)
            image = base64.b64encode(pixmap.tobytes("jpeg", jpg_quality=82)).decode("ascii")
            pages.append({"number": page_number, "image": f"data:image/jpeg;base64,{image}"})
        document.close()
        return pages
    except Exception as error:
        logger.exception("Unable to render proposal PDF preview.")
        raise OfficialProposalPdfError("Não foi possível preparar a pré-visualização do documento.") from error


def _generate_official_proposal_response(proposta_id, mode="", document_type="", preview_as_images=False):
    """Build the approved proposal document and expose it as a PDF response."""
    proposta = get_object_or_404(
        Financeiro.objects.select_related(
            "cliente__Cliente",
            "cliente__Unidade",
            "unidade__Cliente",
            "unidade__Unidade",
            "tipo_operacao",
            "metodo",
            "metodo_cadastro",
            "cordenador",
        ).prefetch_related("campos"),
        pk=proposta_id,
    )

    try:
        serialized = _serialize_financeiro(proposta)
        documento = None
        revisao_payload = None
        document_image_paths = []
        template_key = None
        if _is_offshore_proposal(proposta):
            documento = PropostaDocumentoRevisao.objects.filter(
                proposta=proposta,
                numero_revisao=proposta.revisao,
                tipo_documento=PropostaDocumentoRevisao.TIPO_OFFSHORE,
            ).prefetch_related("linhas", "imagens").first()
            if not documento:
                raise OfficialProposalPdfError("Não foi possível carregar a revisão documental desta proposta. O PDF não foi gerado.")
            if mode not in {"preview", "final"}:
                raise OfficialProposalPdfError("Abra a revisão documental antes de gerar o PDF Offshore.")
            if mode == "final":
                required = ("procedimento_confirmado", "equipe_confirmada", "equipamentos_confirmados", "premissas_confirmadas", "obrigacoes_confirmadas")
                if not all(getattr(documento, field) for field in required):
                    raise OfficialProposalPdfError("Confirme todas as seções da revisão documental antes de gerar o PDF oficial.")
            revisao_payload = _document_revision_payload(documento, proposta)
            document_image_paths = [str(image.imagem.path) for image in documento.imagens.all() if image.imagem]
        elif _is_onshore_proposal(proposta):
            type_to_template = {
                PropostaDocumentoRevisao.TIPO_PC_ONSHORE: "pc_onshore",
                PropostaDocumentoRevisao.TIPO_PT_ONSHORE: "pt_onshore",
            }
            if document_type not in type_to_template:
                raise OfficialProposalPdfError("Escolha a Proposta Comercial (PC) ou a Proposta Técnica (PT) antes de gerar o documento.")
            if mode not in {"preview", "final"}:
                raise OfficialProposalPdfError("Abra e revise o documento Onshore antes de gerar o PDF.")
            documento = PropostaDocumentoRevisao.objects.filter(
                proposta=proposta,
                numero_revisao=proposta.revisao,
                tipo_documento=document_type,
            ).prefetch_related("linhas", "imagens").first()
            if not documento:
                raise OfficialProposalPdfError("Não foi possível carregar a revisão documental selecionada. O PDF não foi gerado.")
            if document_type == PropostaDocumentoRevisao.TIPO_PT_ONSHORE and mode == "final":
                expected_preview = _pt_review_fingerprint(documento.conteudo_revisao)
                if documento.conteudo_revisao.get("preview_hash") != expected_preview:
                    raise OfficialProposalPdfError(
                        "A proposta foi alterada apos a ultima pre-visualizacao. Gere uma nova previa antes de emitir o PDF oficial."
                    )
            revisao_payload = _document_revision_payload(documento, proposta)
            template_key = type_to_template[document_type]
            if document_type == PropostaDocumentoRevisao.TIPO_PC_ONSHORE:
                document_image_paths = [str(image.imagem.path) for image in documento.imagens.all() if image.imagem]
        pdf_content, filename = generate_official_proposal_pdf(
            proposta,
            serialized=serialized,
            items=serialized.get("campos") or [],
            document_revision=revisao_payload,
            template_key=template_key,
            preserve_variable_highlights=mode != "final",
            document_image_paths=document_image_paths,
        )
        if preview_as_images:
            if documento and document_type == PropostaDocumentoRevisao.TIPO_PT_ONSHORE:
                conteudo = dict(documento.conteudo_revisao or {})
                conteudo["preview_hash"] = _pt_review_fingerprint(conteudo)
                conteudo["previewed_em"] = timezone.now().isoformat()
                documento.conteudo_revisao = conteudo
                documento.save(update_fields=("conteudo_revisao", "atualizado_em"))
            confirmations = (
                ("procedimento_confirmado", "Procedimento"),
                ("equipe_confirmada", "Equipe"),
                ("equipamentos_confirmados", "Equipamentos"),
                ("premissas_confirmadas", "Premissas"),
                ("obrigacoes_confirmadas", "Obrigações da contratante"),
            )
            pending_sections = [label for field, label in confirmations if documento and _is_offshore_proposal(proposta) and not getattr(documento, field)]
            return JsonResponse({
                "success": True,
                "pages": _render_pdf_preview_pages(pdf_content),
                "filename": filename,
                "can_generate": not pending_sections,
                "pending_sections": pending_sections,
            })
        if documento and mode == "final":
            PropostaDocumentoFinanceiroSnapshot.objects.filter(documento=documento).delete()
            for order, campo in enumerate(proposta.campos.all(), start=1):
                PropostaDocumentoFinanceiroSnapshot.objects.create(documento=documento, ordem=order, descricao=campo.get_nome_display(), preco_unitario=campo.preco_unitario, quantidade=campo.quantidade, subtotal=campo.subtotal)
            documento.status = PropostaDocumentoRevisao.STATUS_GERADA
            documento.gerado_em = timezone.now()
            documento.save(update_fields=("status", "gerado_em", "atualizado_em"))
    except OfficialProposalPdfError as error:
        logger.warning("Unable to generate official proposal %s: %s", proposta_id, error)
        return HttpResponse(str(error), status=400, content_type="text/plain; charset=utf-8")
    except Exception:
        logger.exception("Error generating official proposal %s.", proposta_id)
        return HttpResponse(
            "Nao foi possivel gerar a proposta oficial. Tente novamente.",
            status=500,
            content_type="text/plain; charset=utf-8",
        )

    response = HttpResponse(pdf_content, content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


@login_required(login_url="/login/")
@commercial_preview_required
@require_GET
def comercial_gerar_pdf_proposta(request, proposta_id):
    return _generate_official_proposal_response(
        proposta_id,
        request.GET.get("document_mode", ""),
        request.GET.get("document_type", ""),
        preview_as_images=request.GET.get("preview_format") == "images",
    )

    """Generate a proposal PDF from the persisted Commercial data."""
    """Generate a proposal PDF from the persisted Commercial data."""
    proposta = get_object_or_404(
        Financeiro.objects.select_related(
            "cliente__Cliente",
            "cliente__Unidade",
            "unidade__Cliente",
            "unidade__Unidade",
            "tipo_operacao",
            "metodo",
            "metodo_cadastro",
            "cordenador",
        ).prefetch_related("campos"),
        pk=proposta_id,
    )

    try:
        from html import escape

        from reportlab.lib import colors
        from reportlab.lib.enums import TA_RIGHT
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.lib.units import cm
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

        serialized = _serialize_financeiro(proposta)
        stage_key = serialized.get("kanbanStage")
        stage_label = next(
            (stage["label"] for stage in KANBAN_STAGES if stage["key"] == stage_key),
            "N\u00e3o classificada",
        )
        styles = getSampleStyleSheet()
        styles.add(ParagraphStyle(
            name="CommercialPdfTitle",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=21,
            leading=25,
            textColor=colors.HexColor("#14213d"),
            spaceAfter=3,
        ))
        styles.add(ParagraphStyle(
            name="CommercialPdfHeading",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=12,
            leading=15,
            textColor=colors.HexColor("#14213d"),
            spaceBefore=15,
            spaceAfter=7,
        ))
        styles.add(ParagraphStyle(
            name="CommercialPdfBody",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#26364c"),
        ))
        styles.add(ParagraphStyle(
            name="CommercialPdfLabel",
            parent=styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=7.5,
            leading=10,
            textColor=colors.HexColor("#69798f"),
        ))
        styles.add(ParagraphStyle(
            name="CommercialPdfValue",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#14213d"),
        ))
        styles.add(ParagraphStyle(
            name="CommercialPdfNumeric",
            parent=styles["CommercialPdfValue"],
            alignment=TA_RIGHT,
        ))

        def paragraph(value, style="CommercialPdfBody"):
            text = escape(str(value or "-")).replace("\n", "<br/>")
            return Paragraph(text, styles[style])

        def detail_cell(label, value):
            return [
                Paragraph(escape(label), styles["CommercialPdfLabel"]),
                paragraph(value, "CommercialPdfValue"),
            ]

        pdf_io = BytesIO()
        document = SimpleDocTemplate(
            pdf_io,
            pagesize=A4,
            leftMargin=1.5 * cm,
            rightMargin=1.5 * cm,
            topMargin=1.4 * cm,
            bottomMargin=1.4 * cm,
        )
        proposal_status = serialized.get("statusProposta") or "Status n\u00e3o informado"
        story = [
            Paragraph("SYNCHRO COMERCIAL", styles["CommercialPdfLabel"]),
            Paragraph(f"Proposta {escape(serialized['numeroProposta'])}", styles["CommercialPdfTitle"]),
            paragraph(serialized.get("empresa") or "Cliente n\u00e3o informado"),
            Spacer(1, 0.28 * cm),
            paragraph(
                f"REV {serialized.get('rev') or '00'} &nbsp;&nbsp;|&nbsp;&nbsp; "
                f"{proposal_status} &nbsp;&nbsp;|&nbsp;&nbsp; "
                f"Gerado em {timezone.localtime().strftime('%d/%m/%Y %H:%M')}",
                "CommercialPdfBody",
            ),
        ]

        sections = [
            ("Dados da proposta", [
                ("Fase do pipeline", stage_label), ("Natureza", serialized.get("natureza")),
                ("Respons\u00e1vel comercial", serialized.get("responsavel")), ("Coordenador", serialized.get("coordenador")),
                ("Tipo de opera\u00e7\u00e3o", serialized.get("tipoOperacao")), ("Unidade / Local", serialized.get("unidade")),
                ("Emiss\u00e3o", serialized.get("emissao")), ("Entrega da proposta", serialized.get("dataEntregaProposta")),
                ("Previs\u00e3o de contrata\u00e7\u00e3o", serialized.get("previsaoContratacao")), ("Tempo de contrato", serialized.get("tempoContratoDias")),
            ]),
            ("Contato e refer\u00eancia", [
                ("Solicitante", serialized.get("solicitante")), ("PO / Pedido", serialized.get("po")), ("RFI", serialized.get("rfi")),
                ("E-mail", serialized.get("emailSolicitante")), ("Telefone", serialized.get("telefoneSolicitante")),
            ]),
            ("Escopo e valores", [
                ("Servi\u00e7o / Escopo", serialized.get("escopo")), ("Receita estimada", serialized.get("estimativaReceita")),
            ]),
        ]
        for title, details in sections:
            story.append(Paragraph(title, styles["CommercialPdfHeading"]))
            data = []
            for index in range(0, len(details), 2):
                left = detail_cell(*details[index])
                right = detail_cell(*details[index + 1]) if index + 1 < len(details) else detail_cell("", "")
                data.append([left, right])
            table = Table(data, colWidths=[8.7 * cm, 8.7 * cm])
            table.setStyle(TableStyle([
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#dfe6ee")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dfe6ee")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]))
            story.append(table)

        story.append(Paragraph("Equipamentos / Itens da Proposta", styles["CommercialPdfHeading"]))
        campos = serialized.get("campos") or []
        if campos:
            rows = [[
                paragraph("Item / Equipamento", "CommercialPdfLabel"),
                paragraph("Pre\u00e7o unit\u00e1rio", "CommercialPdfLabel"),
                paragraph("Quantidade", "CommercialPdfLabel"),
                paragraph("Subtotal", "CommercialPdfLabel"),
            ]]
            for campo in campos:
                rows.append([
                    paragraph(campo.get("label")),
                    paragraph(f"R$ {campo.get('preco_unitario')}", "CommercialPdfNumeric"),
                    paragraph(campo.get("quantidade"), "CommercialPdfNumeric"),
                    paragraph(f"R$ {campo.get('subtotal')}", "CommercialPdfNumeric"),
                ])
            rows.append([
                paragraph("Total estimado dos itens", "CommercialPdfLabel"), "", "",
                paragraph(serialized.get("totalCamposFormatado"), "CommercialPdfNumeric"),
            ])
            items_table = Table(rows, colWidths=[8.0 * cm, 3.0 * cm, 2.2 * cm, 4.2 * cm])
            items_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f3f6f8")),
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#f4fae8")),
                ("LINEBELOW", (0, 0), (-1, -2), 0.5, colors.HexColor("#dfe6ee")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#dfe6ee")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]))
            story.append(items_table)
        else:
            story.append(paragraph("Nenhum item/equipamento cadastrado para esta proposta."))

        if serialized.get("comentario"):
            story.append(Paragraph("Coment\u00e1rios", styles["CommercialPdfHeading"]))
            story.append(paragraph(serialized["comentario"]))

        document.build(story)
        pdf_content = pdf_io.getvalue()
    except Exception:
        logger.exception("Erro ao gerar PDF da proposta comercial %s.", proposta_id)
        return HttpResponse(
            "N\u00e3o foi poss\u00edvel gerar o PDF da proposta. Tente novamente.",
            status=500,
            content_type="text/plain; charset=utf-8",
        )

    response = HttpResponse(pdf_content, content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="proposta_{proposta.proposta}.pdf"'
    return response


@login_required(login_url="/login/")
@commercial_preview_required
@require_GET
def comercial_gerar_pdf_analise_critica(request, proposta_id):
    """Generate a PDF containing only the persisted critical opportunity analysis."""
    proposta = get_object_or_404(
        Financeiro.objects.select_related(
            "cliente__Cliente",
            "unidade__Unidade",
            "analise_critica_oportunidade",
        ),
        pk=proposta_id,
    )

    try:
        serialized = _serialize_financeiro(proposta)
        # The report built below is the dedicated critical-analysis document.
        pdf_content, filename = b"", ""
    except OfficialProposalPdfError as error:
        logger.warning("Não foi possível gerar a proposta oficial %s: %s", proposta_id, error)
        return HttpResponse(str(error), status=400, content_type="text/plain; charset=utf-8")
    except Exception:
        logger.exception("Erro ao gerar a proposta oficial %s.", proposta_id)
        return HttpResponse(
            "Não foi possível gerar a proposta oficial. Tente novamente.",
            status=500,
            content_type="text/plain; charset=utf-8",
        )

    # Keep the dedicated ReportLab form below as the only response for this endpoint.

    try:
        from html import escape

        from reportlab.lib import colors
        from reportlab.lib.enums import TA_CENTER
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.lib.units import cm
        from reportlab.platypus import Image as ReportLabImage, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

        serialized = _serialize_financeiro(proposta)
        analysis = serialized.get("analiseCriticaOportunidade") or {}
        answers = analysis.get("respostas") or {}
        styles = getSampleStyleSheet()
        styles.add(ParagraphStyle(
            name="CriticalFormBody",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=7.6,
            leading=9.1,
            textColor=colors.black,
        ))
        styles.add(ParagraphStyle(
            name="CriticalFormLabel",
            parent=styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=7.6,
            leading=9.1,
            textColor=colors.black,
        ))
        styles.add(ParagraphStyle(
            name="CriticalFormHeader",
            parent=styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=7.6,
            leading=9.1,
            alignment=TA_CENTER,
            textColor=colors.black,
        ))
        styles.add(ParagraphStyle(
            name="CriticalFormTitle",
            parent=styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=10,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#777777"),
        ))
        styles.add(ParagraphStyle(
            name="CriticalFormLogo",
            parent=styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=18,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#888888"),
        ))

        def paragraph(value, style="CriticalFormBody"):
            return Paragraph(escape(str(value or "-")).replace(chr(10), "<br/>"), styles[style])

        def field_value(label, value):
            safe_value = escape(str(value or "")).replace(chr(10), "<br/>")
            return Paragraph(f"<b>{escape(label)}</b> {safe_value}", styles["CriticalFormBody"])

        def field_label(label):
            return Paragraph(f"<b>{escape(label)}</b>", styles["CriticalFormBody"])

        def form_table(data, widths, commands=None, row_heights=None):
            table = Table(data, colWidths=widths, rowHeights=row_heights)
            table_commands = [
                ("GRID", (0, 0), (-1, -1), 0.6, colors.black),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ]
            if commands:
                table_commands.extend(commands)
            table.setStyle(TableStyle(table_commands))
            return table

        def answer_value(field_name):
            return {
                "SIM": "SIM",
                "NAO": "NÃO",
                "NA": "NA",
            }.get(answers.get(field_name), "")

        def criterion_row(field_name):
            return [paragraph(CRITICAL_ANALYSIS_QUESTIONS[field_name]), paragraph(answer_value(field_name), "CriticalFormHeader")]

        green = colors.HexColor("#92d050")
        content_width = 17.6 * cm
        label_width = 6.2 * cm
        logo_path = os.path.join(os.path.dirname(__file__), "static", "js", "img", "Logo_Preto.png")
        logo = (
            ReportLabImage(logo_path, width=3.05 * cm, height=0.89 * cm)
            if os.path.exists(logo_path)
            else Paragraph("ambipar<super>®</super>", styles["CriticalFormLogo"])
        )
        pdf_io = BytesIO()
        document = SimpleDocTemplate(
            pdf_io,
            pagesize=A4,
            leftMargin=1.45 * cm,
            rightMargin=1.45 * cm,
            topMargin=0.95 * cm,
            bottomMargin=0.7 * cm,
        )
        story = []
        story.append(form_table(
            [[
                logo,
                Paragraph("ANÁLISE CRÍTICA DA OPORTUNIDADE", styles["CriticalFormTitle"]),
                Paragraph("FOR-SGQ-034 - Rev.6", styles["CriticalFormTitle"]),
            ]],
            [3.9 * cm, 8.7 * cm, 5.0 * cm],
            row_heights=[1.45 * cm],
        ))
        story.append(Spacer(1, 0.5 * cm))

        story.append(form_table(
            [
                [field_value("Número da Proposta:", serialized.get("numeroProposta")), "", ""],
                [field_value("Fonte do lead:", serialized.get("fonteLead")), "", field_value("Data:", serialized.get("emissao"))],
            ],
            [6.2 * cm, 6.0 * cm, 5.4 * cm],
            commands=[("SPAN", (0, 0), (2, 0))],
        ))
        story.append(Spacer(1, 0.42 * cm))

        offshore = str(serialized.get("tipoOperacao") or "").strip().lower() == "offshore"
        onshore = str(serialized.get("tipoOperacao") or "").strip().lower() == "onshore"
        story.append(form_table(
            [
                [field_label("Cliente:"), paragraph(serialized.get("empresa"))],
                [field_label("Unidade / Plataforma / Planta"), paragraph(serialized.get("unidade"))],
                [field_label("Tipo de operação"), paragraph(f"( {'X' if onshore else ' '} ) Onshore    ( {'X' if offshore else ' '} ) Offshore")],
                [field_label("Serviço:"), paragraph(serialized.get("escopo") or serialized.get("servico"))],
                [field_label("Local de embarque / local da operação:"), paragraph(serialized.get("embarcacaoLocal"))],
                [field_label("Data prevista da operação:"), paragraph(serialized.get("dataEntregaProposta"))],
            ],
            [label_width, content_width - label_width],
        ))
        story.append(Spacer(1, 0.55 * cm))

        criteria_rows = [
            [paragraph("CRITÉRIO", "CriticalFormHeader"), paragraph("AVALIAÇÃO", "CriticalFormHeader")],
            [paragraph("Requisitos do cliente", "CriticalFormLabel"), ""],
            criterion_row("capacidade_atender_requisitos"),
            criterion_row("habilitacao_tecnica_atendida"),
            [paragraph("Requisitos técnicos", "CriticalFormLabel"), ""],
            criterion_row("visita_tecnica_necessaria"),
            criterion_row("escopo_claramente_definido"),
            criterion_row("competencia_tecnica_execucao"),
            [paragraph("Recursos operacionais", "CriticalFormLabel"), ""],
            criterion_row("recursos_disponiveis"),
            criterion_row("equipe_com_treinamentos"),
            criterion_row("equipe_irata_disponivel"),
            criterion_row("equipe_resgate_disponivel"),
            [paragraph("Logística", "CriticalFormLabel"), ""],
            criterion_row("tempo_habil_mobilizacao"),
            criterion_row("tempo_habil_aquisicao"),
            [paragraph("Viabilidade comercial", "CriticalFormLabel"), ""],
            criterion_row("riscos_comerciais_relevantes"),
            criterion_row("oportunidade_viavel_rentavel"),
            criterion_row("pendencias_financeiras_cliente"),
            [paragraph("OBSERVAÇÕES GERAIS", "CriticalFormLabel"), ""],
            [paragraph(analysis.get("comentario") or ""), ""],
        ]
        group_rows = [1, 4, 8, 13, 16, 20]
        criteria_table = form_table(
            criteria_rows,
            [14.6 * cm, 3.0 * cm],
            commands=[
                ("BACKGROUND", (0, 0), (-1, 0), green),
                *[("BACKGROUND", (0, row), (-1, row), green) for row in group_rows],
                ("SPAN", (0, 1), (1, 1)),
                ("SPAN", (0, 4), (1, 4)),
                ("SPAN", (0, 8), (1, 8)),
                ("SPAN", (0, 13), (1, 13)),
                ("SPAN", (0, 16), (1, 16)),
                ("SPAN", (0, 20), (1, 20)),
                ("SPAN", (0, 21), (1, 21)),
                ("ALIGN", (1, 0), (1, -1), "CENTER"),
            ],
        )
        story.append(criteria_table)
        story.append(Spacer(1, 0.45 * cm))

        participate = answers.get("iremos_participar")
        participation_rows = [
            [field_value("Participaremos da oportunidade?", f"( {'X' if participate == 'SIM' else ' '} ) Sim    ( {'X' if participate == 'NAO' else ' '} ) Não")],
            [field_value("Motivo:", serialized.get("motivoDeclinioPerda") if participate == "NAO" else "")],
        ]
        story.append(form_table(participation_rows, [content_width], row_heights=[0.7 * cm, 0.7 * cm]))
        story.append(Spacer(1, 0.45 * cm))
        story.append(form_table(
            [[
                paragraph("Nome", "CriticalFormHeader"),
                paragraph("Setor", "CriticalFormHeader"),
                paragraph("Assinatura", "CriticalFormHeader"),
            ], ["", "", ""]],
            [5.7 * cm, 5.7 * cm, 6.2 * cm],
            commands=[("BACKGROUND", (0, 0), (-1, 0), green)],
            row_heights=[0.55 * cm, 1.15 * cm],
        ))

        document.build(story)
        pdf_content = pdf_io.getvalue()
    except Exception:
        logger.exception("Erro ao gerar PDF da análise crítica da proposta %s.", proposta_id)
        return HttpResponse(
            "Não foi possível gerar o PDF da análise crítica. Tente novamente.",
            status=500,
            content_type="text/plain; charset=utf-8",
        )

    response = HttpResponse(pdf_content, content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="analise_critica_proposta_{proposta.proposta}.pdf"'
    return response


@login_required(login_url="/login/")
@commercial_preview_required
@require_POST
@transaction.atomic
def comercial_atualizar_proposta(request, proposta_id):
    proposta = get_object_or_404(Financeiro, pk=proposta_id)
    payload = _read_request_json(request)
    errors = _update_financeiro_from_payload(proposta, payload)
    critical_answers, critical_errors, critical_comment = _parse_critical_analysis_payload(payload)
    errors.update(critical_errors)
    campos = None
    if "campos" in payload:
        campos, campo_errors = _parse_financeiro_campos_payload(payload)
        if campo_errors:
            errors.update(campo_errors)
    if errors:
        return JsonResponse(
            {
                "success": False,
                "message": "Não foi possível atualizar a proposta com os dados enviados.",
                "errors": errors,
            },
            status=400,
        )

    proposta.save()
    if campos is not None:
        _sync_financeiro_campos(proposta, campos)
    if critical_answers is not None:
        _save_critical_analysis(proposta, critical_answers, critical_comment, request.user)
    return JsonResponse(
        {
            "success": True,
            "message": "Proposta atualizada com sucesso.",
            "proposal": _serialize_financeiro(proposta),
        }
    )


@login_required(login_url="/login/")
@commercial_preview_required
@require_POST
def comercial_atualizar_status(request, proposta_id):
    proposta = get_object_or_404(Financeiro, pk=proposta_id)
    payload = _read_request_json(request)

    next_status = _clean_text(payload.get("status_proposta"))
    motivo = _clean_text(payload.get("motivo_perda"))

    if not next_status:
        return JsonResponse(
            {"success": False, "message": "Selecione um status válido."},
            status=400,
        )

    proposta.status_proposta = next_status
    proposta.motivo_perda = motivo or proposta.motivo_perda or "N/A"
    _append_history_to_bundle(
        proposta,
        {
            "usuario": _clean_text(request.user.get_username()) or _clean_text(proposta.responsavel),
            "acao": "Status alterado",
            "detalhe": f"Status alterado para {_display_status(next_status)}.",
        },
    )
    proposta.save(update_fields=["status_proposta", "motivo_perda", "follow_up"])

    return JsonResponse(
        {
            "success": True,
            "message": "Status atualizado com sucesso.",
            "proposal": _serialize_financeiro(proposta),
        }
    )

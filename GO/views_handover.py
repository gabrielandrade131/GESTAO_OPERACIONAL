from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse, JsonResponse
from django.views.decorators.http import require_GET, require_POST
from django.template.loader import render_to_string
from django.contrib import messages
from django.contrib.auth import get_user_model
from django.db.models import Q
import logging
from datetime import date

from .models import SupervisorHandover, Cliente, Unidade, OrdemServico

logger = logging.getLogger(__name__)
User = get_user_model()

# Lista de itens padrão para inicialização do formulário
ITEMS_PADRAO = [
    "Container", "Caixa", "Skid", "Detector de gás", "Rádios",
    "Luminárias (kit com 3)", "EPRD", "Ventilador", "Kit de resgate",
    "Máquina de hidrojato", "Desincrustador de convés"
]


@login_required
@require_GET
def handover_ultimo_api(request):
    """Retorna o último handover do supervisor autenticado para pré-preenchimento."""
    try:
        handover = (
            SupervisorHandover.objects
            .filter(supervisor_atual=request.user)
            .order_by('-criado_em', '-id')
            .first()
        )
    except Exception:
        logger.exception('Erro ao carregar último handover para o modal RDO')
        return JsonResponse({'success': False, 'error': 'Não foi possível carregar a última passagem de serviço.'}, status=500)

    if handover is None:
        return JsonResponse({'success': True, 'handover': None})

    return JsonResponse({
        'success': True,
        'handover': {
            'periodo_data': handover.periodo_data or '',
            'servico_concluido': handover.servico_concluido or '',
            'servico_em_andamento': handover.servico_em_andamento or '',
            'orientacoes_observacoes': handover.orientacoes_observacoes or '',
            'itens_equipamentos': handover.itens_equipamentos or [],
        },
    })


@login_required
@require_POST
def handover_criar_api(request):
    """Cria a passagem pelo modal do RDO, sem liberar a tela administrativa."""
    os_id = (request.POST.get('ordem_servico_id') or request.POST.get('os_id') or '').strip()
    periodo_data = (request.POST.get('periodo_data') or '').strip()
    if not os_id:
        return JsonResponse({'success': False, 'error': 'Ordem de serviço não informada.'}, status=400)
    if not periodo_data:
        return JsonResponse({'success': False, 'error': 'Período/data é obrigatório.'}, status=400)

    ordem_servico = OrdemServico.objects.filter(pk=os_id).first()
    if ordem_servico is None:
        return JsonResponse({'success': False, 'error': 'Ordem de serviço não encontrada.'}, status=404)

    try:
        is_supervisor = request.user.groups.filter(name='Supervisor').exists()
    except Exception:
        is_supervisor = False
    if is_supervisor and getattr(ordem_servico, 'supervisor', None) != request.user:
        return JsonResponse({'success': False, 'error': 'Sem permissão para registrar handover desta OS.'}, status=403)

    itens = []
    for index, descricao in enumerate(ITEMS_PADRAO, 1):
        itens.append({
            'item': index,
            'descricao': descricao,
            'quantidade': (request.POST.get(f'qty_{index}') or '').strip(),
            'comentario': (request.POST.get(f'comment_{index}') or '').strip(),
        })

    try:
        handover = SupervisorHandover.objects.create(
            periodo_data=periodo_data[:100],
            ordem_servico=ordem_servico,
            cliente=getattr(ordem_servico, 'Cliente', None),
            unidade=getattr(ordem_servico, 'Unidade', None),
            projeto=str(
                getattr(ordem_servico, 'especificacao', '')
                or getattr(ordem_servico, 'servico', '')
                or ''
            ).strip()[:150],
            supervisor_atual=request.user,
            servico_concluido=(request.POST.get('servico_concluido') or '').strip(),
            servico_em_andamento=(request.POST.get('servico_em_andamento') or '').strip(),
            orientacoes_observacoes=(request.POST.get('orientacoes_observacoes') or '').strip(),
            itens_equipamentos=itens,
        )
    except Exception:
        logger.exception('Erro ao criar Passagem de Serviço pelo modal RDO')
        return JsonResponse({'success': False, 'error': 'Não foi possível salvar a passagem de serviço.'}, status=500)

    return JsonResponse({
        'success': True,
        'id': handover.id,
        'message': 'Passagem de serviço criada com sucesso.',
    })

@login_required
def handover_list(request):
    """Lista as passagens de serviço aplicando os filtros informados via GET."""
    filtros = {
        'busca': (request.GET.get('busca') or '').strip(),
        'cliente': (request.GET.get('cliente') or '').strip(),
        'unidade': (request.GET.get('unidade') or '').strip(),
        'supervisor': (request.GET.get('supervisor') or '').strip(),
        'coordenador': (request.GET.get('coordenador') or '').strip(),
        'data_inicio': (request.GET.get('data_inicio') or '').strip(),
        'data_fim': (request.GET.get('data_fim') or '').strip(),
    }

    handovers = SupervisorHandover.objects.select_related(
        'cliente', 'unidade', 'supervisor_atual', 'supervisor_back', 'ordem_servico',
        'ordem_servico__coordenador_cadastro'
    )

    if filtros['busca']:
        handovers = handovers.filter(
            Q(periodo_data__icontains=filtros['busca'])
            | Q(projeto__icontains=filtros['busca'])
            | Q(cliente__nome__icontains=filtros['busca'])
            | Q(unidade__nome__icontains=filtros['busca'])
            | Q(supervisor_atual__username__icontains=filtros['busca'])
            | Q(supervisor_atual__first_name__icontains=filtros['busca'])
            | Q(supervisor_atual__last_name__icontains=filtros['busca'])
            | Q(supervisor_back__username__icontains=filtros['busca'])
            | Q(supervisor_back__first_name__icontains=filtros['busca'])
            | Q(supervisor_back__last_name__icontains=filtros['busca'])
        )

    for nome_filtro, campo in (('cliente', 'cliente_id'), ('unidade', 'unidade_id')):
        try:
            valor = int(filtros[nome_filtro])
        except (TypeError, ValueError):
            continue
        handovers = handovers.filter(**{campo: valor})

    if filtros['supervisor']:
        handovers = handovers.filter(
            Q(supervisor_atual__username__icontains=filtros['supervisor'])
            | Q(supervisor_atual__first_name__icontains=filtros['supervisor'])
            | Q(supervisor_atual__last_name__icontains=filtros['supervisor'])
            | Q(supervisor_back__username__icontains=filtros['supervisor'])
            | Q(supervisor_back__first_name__icontains=filtros['supervisor'])
            | Q(supervisor_back__last_name__icontains=filtros['supervisor'])
        )

    if filtros['coordenador']:
        handovers = handovers.filter(
            Q(ordem_servico__coordenador__icontains=filtros['coordenador'])
            | Q(ordem_servico__coordenador_cadastro__nome__icontains=filtros['coordenador'])
        )

    for nome_filtro, lookup in (('data_inicio', 'criado_em__date__gte'), ('data_fim', 'criado_em__date__lte')):
        try:
            valor = date.fromisoformat(filtros[nome_filtro])
        except (TypeError, ValueError):
            continue
        handovers = handovers.filter(**{lookup: valor})

    handovers = handovers.order_by('-criado_em')
    return render(request, 'handover_list.html', {
        'handovers': handovers,
        'clientes': Cliente.objects.filter(ativo=True).order_by('nome'),
        'unidades': Unidade.objects.filter(ativo=True).order_by('nome'),
        'supervisores': User.objects.filter(is_active=True).order_by('first_name', 'last_name', 'username'),
        'coordenadores': OrdemServico.objects.exclude(coordenador__isnull=True).exclude(
            coordenador__exact=''
        ).order_by('coordenador').values_list('coordenador', flat=True).distinct(),
        'filtros': filtros,
        'synchro_active_module': 'handover',
    })

@login_required
def handover_criar(request):
    clientes = Cliente.objects.filter(ativo=True)
    unidades = Unidade.objects.filter(ativo=True)
    ordens_servico = OrdemServico.objects.all().order_by('-numero_os')
    usuarios = User.objects.filter(is_active=True).order_by('first_name', 'last_name')
    
    # Inicializa os itens vazios
    itens_form = []
    for idx, desc in enumerate(ITEMS_PADRAO, 1):
        itens_form.append({
            'item': idx,
            'descricao': desc,
            'quantidade': '',
            'comentario': ''
        })

    # Dados pré-preenchidos se vier por GET os_id
    prefilled_os = None
    os_id = request.GET.get('os_id')
    if os_id:
        try:
            prefilled_os = OrdemServico.objects.filter(pk=os_id).first() or OrdemServico.objects.filter(numero_os=os_id).first()
        except Exception:
            pass

    if request.method == 'POST':
        periodo_data = request.POST.get('periodo_data', '').strip()
        cliente_id = request.POST.get('cliente', '').strip()
        unidade_id = request.POST.get('unidade', '').strip()
        projeto = request.POST.get('projeto', '').strip()
        supervisor_back_id = request.POST.get('supervisor_back', '').strip()
        ordem_servico_id = request.POST.get('ordem_servico', '').strip()
        
        servico_concluido = request.POST.get('servico_concluido', '').strip()
        servico_em_andamento = request.POST.get('servico_em_andamento', '').strip()
        orientacoes_observacoes = request.POST.get('orientacoes_observacoes', '').strip()
        
        # Processa itens da tabela
        itens_salvar = []
        for idx, desc in enumerate(ITEMS_PADRAO, 1):
            qty = request.POST.get(f'qty_{idx}', '').strip()
            comment = request.POST.get(f'comment_{idx}', '').strip()
            itens_salvar.append({
                'item': idx,
                'descricao': desc,
                'quantidade': qty,
                'comentario': comment
            })
            
        cliente = Cliente.objects.filter(id=cliente_id).first() if cliente_id else None
        unidade = Unidade.objects.filter(id=unidade_id).first() if unidade_id else None
        supervisor_back = User.objects.filter(id=supervisor_back_id).first() if supervisor_back_id else None
        ordem_servico = OrdemServico.objects.filter(id=ordem_servico_id).first() if ordem_servico_id else None
        
        try:
            handover = SupervisorHandover.objects.create(
                periodo_data=periodo_data,
                ordem_servico=ordem_servico,
                cliente=cliente,
                unidade=unidade,
                projeto=projeto,
                supervisor_atual=request.user,
                supervisor_back=supervisor_back,
                servico_concluido=servico_concluido,
                servico_em_andamento=servico_em_andamento,
                orientacoes_observacoes=orientacoes_observacoes,
                itens_equipamentos=itens_salvar
            )
            messages.success(request, 'Passagem de Serviço criada com sucesso!')
            return redirect('handover_list')
        except Exception as e:
            logger.exception('Erro ao criar Passagem de Serviço')
            messages.error(request, f'Erro ao salvar: {e}')
            
    return render(request, 'handover_form.html', {
        'clientes': clientes,
        'unidades': unidades,
        'ordens_servico': ordens_servico,
        'usuarios': usuarios,
        'itens': itens_form,
        'is_edit': False,
        'prefilled_os': prefilled_os,
        'synchro_active_module': 'handover',
    })

@login_required
def handover_editar(request, pk):
    handover = get_object_or_404(SupervisorHandover, pk=pk)
    clientes = Cliente.objects.filter(ativo=True)
    unidades = Unidade.objects.filter(ativo=True)
    ordens_servico = OrdemServico.objects.all().order_by('-numero_os')
    usuarios = User.objects.filter(is_active=True).order_by('first_name', 'last_name')
    
    if request.method == 'POST':
        handover.periodo_data = request.POST.get('periodo_data', '').strip()
        
        cliente_id = request.POST.get('cliente', '').strip()
        handover.cliente = Cliente.objects.filter(id=cliente_id).first() if cliente_id else None
        
        unidade_id = request.POST.get('unidade', '').strip()
        handover.unidade = Unidade.objects.filter(id=unidade_id).first() if unidade_id else None
        
        handover.projeto = request.POST.get('projeto', '').strip()
        ordem_servico_id = request.POST.get('ordem_servico', '').strip()
        handover.ordem_servico = OrdemServico.objects.filter(id=ordem_servico_id).first() if ordem_servico_id else None
        
        supervisor_back_id = request.POST.get('supervisor_back', '').strip()
        handover.supervisor_back = User.objects.filter(id=supervisor_back_id).first() if supervisor_back_id else None
        
        handover.servico_concluido = request.POST.get('servico_concluido', '').strip()
        handover.servico_em_andamento = request.POST.get('servico_em_andamento', '').strip()
        handover.orientacoes_observacoes = request.POST.get('orientacoes_observacoes', '').strip()
        
        # Processa itens da tabela
        itens_salvar = []
        for idx, desc in enumerate(ITEMS_PADRAO, 1):
            qty = request.POST.get(f'qty_{idx}', '').strip()
            comment = request.POST.get(f'comment_{idx}', '').strip()
            itens_salvar.append({
                'item': idx,
                'descricao': desc,
                'quantidade': qty,
                'comentario': comment
            })
        handover.itens_equipamentos = itens_salvar
        
        try:
            handover.save()
            messages.success(request, 'Passagem de Serviço atualizada com sucesso!')
            return redirect('handover_list')
        except Exception as e:
            logger.exception('Erro ao atualizar Passagem de Serviço')
            messages.error(request, f'Erro ao salvar: {e}')
            
    return render(request, 'handover_form.html', {
        'handover': handover,
        'clientes': clientes,
        'unidades': unidades,
        'ordens_servico': ordens_servico,
        'usuarios': usuarios,
        'itens': handover.itens_equipamentos,
        'is_edit': True,
        'synchro_active_module': 'handover',
    })

@login_required
def handover_pdf(request, pk):
    handover = get_object_or_404(SupervisorHandover, pk=pk)
    
    try:
        from weasyprint import HTML
    except Exception:
        return HttpResponse(
            'Exportação para PDF indisponível (WeasyPrint não instalado no ambiente do servidor).',
            status=501,
            content_type='text/plain; charset=utf-8'
        )
        
    context = {
        'handover': handover,
        'itens': handover.itens_equipamentos,
    }
    
    html_str = render_to_string('handover_pdf.html', context, request=request)
    base_url = request.build_absolute_uri('/')
    
    try:
        pdf_bytes = HTML(string=html_str, base_url=base_url).write_pdf()
    except Exception as e:
        logger.exception('Falha ao gerar PDF de Handover via WeasyPrint')
        return HttpResponse(
            f'Falha ao gerar PDF: {e}',
            status=500,
            content_type='text/plain; charset=utf-8'
        )
        
    filename = f'Passagem_de_Servico_{handover.id}.pdf'
    resp = HttpResponse(pdf_bytes, content_type='application/pdf')
    resp['Content-Disposition'] = f'attachment; filename="{filename}"'
    return resp

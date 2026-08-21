from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse
from django.template.loader import render_to_string
from django.contrib import messages
from django.contrib.auth import get_user_model
import logging

from .models import SupervisorHandover, Cliente, Unidade, OrdemServico

logger = logging.getLogger(__name__)
User = get_user_model()

# Lista de itens padrão para inicialização do formulário
ITEMS_PADRAO = [
    "Container", "Caixa", "Skid", "Detector de gás", "Rádios",
    "Luminárias (kit com 3)", "EEBD", "Ventilador", "Kit de resgate",
    "Máquina de hidrojato", "Desincrustador de convés"
]

@login_required
def handover_list(request):
    handovers = SupervisorHandover.objects.all().order_by('-criado_em')
    return render(request, 'handover_list.html', {
        'handovers': handovers,
        'synchro_active_module': 'handover',
    })

@login_required
def handover_criar(request):
    clientes = Cliente.objects.all()
    unidades = Unidade.objects.all()
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
                cliente=cliente,
                unidade=unidade,
                projeto=projeto,
                supervisor_atual=request.user,
                supervisor_back=supervisor_back,
                ordem_servico=ordem_servico,
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
    clientes = Cliente.objects.all()
    unidades = Unidade.objects.all()
    ordens_servico = OrdemServico.objects.all().order_by('-numero_os')
    usuarios = User.objects.filter(is_active=True).order_by('first_name', 'last_name')
    
    if request.method == 'POST':
        handover.periodo_data = request.POST.get('periodo_data', '').strip()
        
        cliente_id = request.POST.get('cliente', '').strip()
        handover.cliente = Cliente.objects.filter(id=cliente_id).first() if cliente_id else None
        
        unidade_id = request.POST.get('unidade', '').strip()
        handover.unidade = Unidade.objects.filter(id=unidade_id).first() if unidade_id else None
        
        handover.projeto = request.POST.get('projeto', '').strip()
        
        supervisor_back_id = request.POST.get('supervisor_back', '').strip()
        handover.supervisor_back = User.objects.filter(id=supervisor_back_id).first() if supervisor_back_id else None
        
        ordem_servico_id = request.POST.get('ordem_servico', '').strip()
        handover.ordem_servico = OrdemServico.objects.filter(id=ordem_servico_id).first() if ordem_servico_id else None

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
    handover = get_object_or_400(SupervisorHandover, pk=pk)
    
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

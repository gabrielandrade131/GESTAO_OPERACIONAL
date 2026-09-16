from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from GO.models import Cliente, Unidade, OrdemServico, RDO, RdoTanque, RDOAtividade, RDOMembroEquipe, Pessoa
from datetime import date, time, timedelta
from decimal import Decimal
import random

User = get_user_model()


class Command(BaseCommand):
    help = 'Cria uma Ordem de Serviço (OS) fake/teste para o ambiente de homologação associada a um supervisor.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--supervisor',
            type=str,
            help='Username do supervisor ao qual a OS será atribuída (ex: supervisor1). Se não fornecido, usa o primeiro supervisor disponível ou cria um.',
        )
        parser.add_argument(
            '--numero-os',
            type=int,
            help='Número da OS (ex: 9901). Se omitido, gera um número único na faixa 90000+.',
        )
        parser.add_argument(
            '--cliente',
            type=str,
            default='Cliente Teste Homologação',
            help='Nome do cliente.',
        )
        parser.add_argument(
            '--unidade',
            type=str,
            default='FPSO Homolog Alpha',
            help='Nome da unidade/embarcação.',
        )
        parser.add_argument(
            '--servico',
            type=str,
            default='LIMPEZA DE TANQUE DE CARGA',
            help='Serviço principal da OS.',
        )
        parser.add_argument(
            '--tanques',
            type=str,
            default='Tanque 1P, Tanque 1S, Tanque Slop',
            help='Nomes dos tanques separados por vírgula.',
        )
        parser.add_argument(
            '--status',
            type=str,
            default='Em Andamento',
            choices=['Em Andamento', 'Programada', 'Paralizada'],
            help='Status da operação da OS.',
        )
        parser.add_argument(
            '--criar-rdo',
            action='store_true',
            default=True,
            help='Cria automaticamente o RDO #1 vinculado com tanques e atividades de teste.',
        )
        parser.add_argument(
            '--sem-rdo',
            action='store_false',
            dest='criar_rdo',
            help='Não cria RDO inicial.',
        )

    def handle(self, *args, **options):
        supervisor_username = options.get('supervisor')
        supervisor = None

        if supervisor_username:
            try:
                supervisor = User.objects.get(username=supervisor_username)
            except User.DoesNotExist:
                self.stdout.write(self.style.WARNING(f"Supervisor '{supervisor_username}' não encontrado. Criando usuário..."))
                supervisor = User.objects.create_user(
                    username=supervisor_username,
                    email=f"{supervisor_username}@ambipar.com",
                    password="Password@123",
                    first_name="Supervisor",
                    last_name="Homolog",
                )
                group, _ = Group.objects.get_or_create(name="Supervisor")
                supervisor.groups.add(group)
        else:
            supervisor = User.objects.filter(groups__name="Supervisor").first()
            if not supervisor:
                supervisor = User.objects.filter(is_active=True).first()

        if not supervisor:
            self.stdout.write(self.style.WARNING("Nenhum usuário encontrado. Criando 'supervisor_hml'..."))
            supervisor = User.objects.create_user(
                username="supervisor_hml",
                email="supervisor_hml@ambipar.com",
                password="Password@123",
                first_name="Supervisor",
                last_name="HML",
            )
            group, _ = Group.objects.get_or_create(name="Supervisor")
            supervisor.groups.add(group)

        # Garantir cliente e unidade
        cliente_nome = options['cliente']
        cliente, _ = Cliente.objects.get_or_create(nome=cliente_nome)

        unidade_nome = options['unidade']
        unidade, _ = Unidade.objects.get_or_create(nome=unidade_nome)

        # Gerar número de OS único se não fornecido
        numero_os = options.get('numero_os')
        if not numero_os:
            ultimo_num = OrdemServico.objects.order_by('-numero_os').values_list('numero_os', flat=True).first() or 90000
            numero_os = max(ultimo_num + 1, 90001)

        tanques_str = options['tanques']
        servico = options['servico']
        status_op = options['status']

        hoje = date.today()
        os_obj = OrdemServico.objects.filter(numero_os=numero_os).first()
        if not os_obj:
            os_obj = OrdemServico.objects.create(
                numero_os=numero_os,
                especificacao=f"Operação HML de {servico} em {unidade_nome}",
                data_inicio=hoje,
                data_fim=hoje + timedelta(days=30),
                dias_de_operacao=30,
                servico=servico,
                servicos=servico,
                tanques=tanques_str,
                tanque=tanques_str.split(',')[0].strip() if tanques_str else 'Tanque 1',
                volume_tanque=Decimal('1500.00'),
                metodo='Mecanizada',
                pob=6,
                turno='Diurno',
                tipo_operacao='Offshore',
                Cliente=cliente,
                Unidade=unidade,
                supervisor=supervisor,
                status_operacao=status_op,
                status_comercial='Em aberto',
                observacao='OS criada automaticamente para testes e homologação no app mobile.',
            )

        rdo_info = ""
        if options.get('criar_rdo'):
            rdo_obj, rdo_created = RDO.objects.get_or_create(
                ordem_servico=os_obj,
                rdo="1",
                defaults={
                    "data": hoje,
                    "data_inicio": hoje,
                    "turno": "Diurno",
                    "metodo_exec": "Mecanizada",
                    "servico_rdo": servico,
                    "observacoes_rdo_pt": f"Operação de limpeza mecanizada no {os_obj.tanque} realizada conforme planejamento.",
                    "planejamento_pt": "Continuidade dos trabalhos com hidrojateamento e limpeza fina.",
                }
            )
            # Tanque no RDO
            tanque_principal = os_obj.tanque or 'Tanque 1P'
            RdoTanque.objects.get_or_create(
                rdo=rdo_obj,
                tanque_codigo=tanque_principal,
                defaults={
                    "nome_tanque": tanque_principal,
                    "tipo_tanque": "Carga",
                    "numero_compartimentos": 4,
                    "volume_tanque_exec": Decimal("150.00"),
                    "servico_exec": servico,
                    "metodo_exec": "Mecanizada",
                    "espaco_confinado": True,
                    "operadores_simultaneos": 4,
                    "percentual_limpeza_diario": Decimal("25.00"),
                    "percentual_limpeza_cumulativo": Decimal("25.00"),
                    "ensacamento_dia": 50,
                    "ensacamento_cumulativo": 50,
                    "icamento_dia": 40,
                    "icamento_cumulativo": 40,
                    "tambores_dia": 10,
                    "tambores_cumulativo": 10,
                    "total_liquido": 5000,
                    "total_liquido_cumulativo": 5000,
                }
            )
            # Atividades do dia
            if not rdo_obj.atividades_rdo.exists():
                RDOAtividade.objects.create(rdo=rdo_obj, ordem=1, atividade="dds", inicio=time(7, 0), fim=time(7, 30), comentario_pt="DDS e liberação de permissão de trabalho (PT/PET).")
                RDOAtividade.objects.create(rdo=rdo_obj, ordem=2, atividade="organizacao", inicio=time(7, 30), fim=time(9, 0), comentario_pt="Organização e preparação dos equipamentos na área.")
                RDOAtividade.objects.create(rdo=rdo_obj, ordem=3, atividade="lavagem", inicio=time(9, 0), fim=time(17, 30), comentario_pt=f"Limpeza mecanizada e bombeio do {tanque_principal}.")
                RDOAtividade.objects.create(rdo=rdo_obj, ordem=4, atividade="desmobilizacao", inicio=time(17, 30), fim=time(19, 0), comentario_pt="Fechamento do dia e organização.")
            
            p = Pessoa.objects.filter(ativo=True).first()
            if p and not rdo_obj.membros_equipe.exists():
                RDOMembroEquipe.objects.create(rdo=rdo_obj, pessoa=p, funcao="Operador")

            rdo_info = f"\n   - RDO #1: ID {rdo_obj.id} (Criado e pronto para visualização/WhatsApp)"

        self.stdout.write(self.style.SUCCESS(
            f"\n✅ OS fake configurada com sucesso!"
            f"\n   - ID: {os_obj.id}"
            f"\n   - Número da OS: {os_obj.numero_os}"
            f"\n   - Supervisor: {supervisor.username} (Nome: {supervisor.get_full_name() or supervisor.username})"
            f"\n   - Cliente: {cliente.nome}"
            f"\n   - Unidade: {unidade.nome}"
            f"\n   - Serviço: {os_obj.servico}"
            f"\n   - Tanques: {os_obj.tanques}"
            f"\n   - Status Operação: {os_obj.status_operacao}"
            f"{rdo_info}"
            f"\n\n📱 Ao abrir ou atualizar o app HML com o supervisor '{supervisor.username}', o RDO estará disponível."
        ))

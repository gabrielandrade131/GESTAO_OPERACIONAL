from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = (
        'Marca como em serviço os membros de RDOs manuais sem planejamento de equipe. '
        'Sem --apply, apenas informa o impacto.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--apply',
            action='store_true',
            help='Aplica a normalização. Sem esta flag, executa em modo de conferência.',
        )

    def handle(self, *args, **options):
        from GO.models import PlanejamentoEquipeOS, RDO, RDOMembroEquipe

        planned_os_ids = PlanejamentoEquipeOS.objects.values('ordem_servico_id')
        affected_members = RDOMembroEquipe.objects.filter(
            rdo__equipe_origem=RDO.EQUIPE_ORIGEM_MANUAL,
            em_servico=False,
        ).exclude(rdo__ordem_servico_id__in=planned_os_ids)
        affected_rdos = (
            RDO.objects.filter(
                equipe_origem=RDO.EQUIPE_ORIGEM_MANUAL,
                membros_equipe__in=affected_members,
            )
            .exclude(ordem_servico_id__in=planned_os_ids)
            .distinct()
        )

        member_count = affected_members.count()
        rdo_count = affected_rdos.count()
        self.stdout.write(
            self.style.NOTICE(
                f'RDOs manuais sem planejamento afetados: {rdo_count}; '
                f'membros a normalizar: {member_count}.'
            )
        )

        if not options['apply']:
            self.stdout.write(
                self.style.WARNING('Conferência concluída. Use --apply para gravar a normalização.')
            )
            return

        with transaction.atomic():
            updated = affected_members.update(em_servico=True)

        self.stdout.write(self.style.SUCCESS(f'Normalização concluída: {updated} membros atualizados.'))

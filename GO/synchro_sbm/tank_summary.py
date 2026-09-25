"""Tank-grain summary; never distribute whole-RDO totals between tanks."""
from collections import defaultdict
from GO.models import RdoTanque


def tank_operations(orders, filters):
    records = RdoTanque.objects.filter(rdo__ordem_servico__in=orders,
                                      rdo__data__isnull=False)
    if filters.get('start'):
        records = records.filter(rdo__data__gte=filters['start'],
                                 rdo__data__lte=filters['end'])
    records = records.select_related('rdo__ordem_servico__Cliente',
                                     'rdo__ordem_servico__Unidade').order_by('rdo__data', 'rdo_id', 'id')
    groups = defaultdict(list)
    for record in records:
        order = record.rdo.ordem_servico
        name = (record.tanque_codigo or record.nome_tanque or '').strip()
        if not name:
            # An unnamed record cannot safely be merged with other tanks.
            key = (order.numero_os, order.Unidade_id, 'record:%s' % record.pk)
        else:
            key = (order.numero_os, order.Unidade_id, ' '.join(name.upper().split()))
        groups[key].append(record)

    result = []
    for key, tanks in groups.items():
        latest = tanks[-1]
        order = latest.rdo.ordem_servico
        first_date, last_date = tanks[0].rdo.data, latest.rdo.data
        confined = [t.operadores_simultaneos for t in tanks
                    if t.operadores_simultaneos is not None]
        # Use Synchro's cumulative compartment calculation, including history
        # before the display period, as of the last selected RDO.
        source = next((t for t in reversed(tanks)
                       if t.normalize_compartimentos_payload(t.compartimentos_avanco_json,
                                                              t.get_total_compartimentos())), latest)
        snapshot = source.build_compartimento_progress_snapshot()
        rows = snapshot.get('rows') or []
        progress = None
        if rows:
            progress = round(sum(float(r['mecanizada']['final']) * .85 +
                                 float(r['fina']['final']) * .15 for r in rows) / len(rows), 2)
        result.append({
            'key': '%s:%s:%s' % key,
            'numero_os': order.numero_os,
            'tanque': (latest.nome_tanque or latest.tanque_codigo or '').strip(),
            'cliente': order.Cliente.nome if order.Cliente else '',
            'unidade': order.Unidade.nome if order.Unidade else '',
            'metodo': next((t.metodo_exec.strip() for t in reversed(tanks)
                            if t.metodo_exec and t.metodo_exec.strip()),
                           (order.metodo or '').strip()),
            'status': order.status_operacao or '',
            'primeiro_rdo': first_date.isoformat(),
            'ultimo_rdo': last_date.isoformat(),
            'dias_operacao': (last_date - first_date).days,
            'avanco': progress,
            'avg_pob_confinado': round(sum(confined) / len(confined), 2) if confined else None,
            'total_ensacamento': sum(t.ensacamento_dia or 0 for t in tanks),
            'total_tambores': sum(t.tambores_dia or 0 for t in tanks),
        })
    return sorted(result, key=lambda row: (row['ultimo_rdo'], str(row['numero_os']), row['tanque']), reverse=True)

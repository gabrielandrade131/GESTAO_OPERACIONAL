# -*- coding: utf-8 -*-
"""
Módulo para geração do texto de Status Operacional formatado para WhatsApp a partir do RDO.
"""
import json
import logging
from datetime import datetime, date, time as dt_time, timedelta

logger = logging.getLogger(__name__)


def _format_time_val(val):
    if val is None or val == '':
        return ''
    if hasattr(val, 'strftime'):
        return val.strftime('%H:%M')
    s = str(val).strip()
    if not s:
        return ''
    if len(s) >= 5 and s[2] == ':':
        return s[:5]
    return s


def _format_duration_val(val):
    if val is None or val == '':
        return ''
    if isinstance(val, timedelta):
        total_seconds = int(val.total_seconds())
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        if minutes > 0:
            return f"{hours}h{minutes:02d}min"
        return f"{hours}h"
    try:
        f = float(val)
        if f.is_integer():
            return f"{int(f)}h"
        return f"{f}h"
    except Exception:
        return str(val).strip()


def build_rdo_whatsapp_text(rdo_obj):
    """
    Gera o texto completo de Status Operacional para compartilhamento no WhatsApp
    conforme o padrão solicitado.
    """
    if not rdo_obj:
        return ""

    try:
        # Data
        data_val = getattr(rdo_obj, 'data', None) or getattr(rdo_obj, 'data_inicio', None)
        if data_val:
            if hasattr(data_val, 'strftime'):
                data_str = data_val.strftime('%d/%m/%Y')
            else:
                data_str = str(data_val)
        else:
            data_str = datetime.now().strftime('%d/%m/%Y')

        # Ordem de Serviço e Relacionamentos
        ordem = getattr(rdo_obj, 'ordem_servico', None)
        numero_os = ''
        if ordem and getattr(ordem, 'numero_os', None):
            numero_os = str(ordem.numero_os)
        elif getattr(rdo_obj, 'contrato_po', None):
            numero_os = str(rdo_obj.contrato_po)

        unidade_nome = ''
        if ordem:
            if hasattr(ordem, 'unidade') and isinstance(ordem.unidade, str) and ordem.unidade:
                unidade_nome = ordem.unidade.strip()
            elif getattr(ordem, 'Unidade', None) and getattr(ordem.Unidade, 'nome', None):
                unidade_nome = str(ordem.Unidade.nome).strip()
            elif getattr(ordem, 'unidade', None) and getattr(ordem.unidade, 'nome', None):
                unidade_nome = str(ordem.unidade.nome).strip()
            elif getattr(ordem, 'unidade_nome', None):
                unidade_nome = str(ordem.unidade_nome).strip()

        cliente_nome = ''
        if ordem:
            if hasattr(ordem, 'cliente') and isinstance(ordem.cliente, str) and ordem.cliente:
                cliente_nome = ordem.cliente.strip()
            elif getattr(ordem, 'Cliente', None) and getattr(ordem.Cliente, 'nome', None):
                cliente_nome = str(ordem.Cliente.nome).strip()
            elif getattr(ordem, 'cliente', None) and getattr(ordem.cliente, 'nome', None):
                cliente_nome = str(ordem.cliente.nome).strip()
            elif getattr(ordem, 'cliente_nome', None):
                cliente_nome = str(ordem.cliente_nome).strip()

        escopo = (
            getattr(rdo_obj, 'servico_exec', None)
            or getattr(rdo_obj, 'servico_rdo', None)
            or (getattr(ordem, 'servico', None) if ordem else None)
            or ''
        )
        escopo = str(escopo).strip()

        # PTs
        pt_manha = str(getattr(rdo_obj, 'pt_manha', '') or '').strip()
        pt_tarde = str(getattr(rdo_obj, 'pt_tarde', '') or '').strip()
        pt_noite = str(getattr(rdo_obj, 'pt_noite', '') or '').strip()

        pt_list = []
        if pt_manha:
            pt_list.append(f"Manhã: {pt_manha}")
        if pt_tarde:
            pt_list.append(f"Tarde: {pt_tarde}")
        if pt_noite:
            pt_list.append(f"Noite: {pt_noite}")

        if pt_list:
            pt_resumo = " | ".join(pt_list)
        elif getattr(rdo_obj, 'exist_pt', None) is not None:
            pt_resumo = "Sim" if rdo_obj.exist_pt else "Não"
        else:
            pt_resumo = ""

        # Tanques
        tanques_qs = getattr(rdo_obj, 'tanques', None)
        first_tank = None
        tank_names = []
        if tanques_qs and hasattr(tanques_qs, 'all'):
            try:
                first_tank = tanques_qs.first()
                for t in tanques_qs.all():
                    t_name = str(getattr(t, 'nome_tanque', '') or getattr(t, 'tanque_codigo', '') or '').strip()
                    if t_name and t_name not in tank_names:
                        tank_names.append(t_name)
            except Exception:
                pass

        if tank_names:
            tanque_str = ", ".join(tank_names)
        else:
            tanque_str = str(getattr(rdo_obj, 'nome_tanque', '') or getattr(rdo_obj, 'tanque_codigo', '') or '').strip()

        # Volume
        volume_val = (
            getattr(first_tank, 'volume_tanque_exec', None)
            if first_tank and getattr(first_tank, 'volume_tanque_exec', None) is not None
            else getattr(rdo_obj, 'volume_tanque_exec', None)
        )
        if volume_val not in (None, ''):
            try:
                vol_num = float(volume_val)
                volume_str = f"{vol_num:.2f} m³" if not vol_num.is_integer() else f"{int(vol_num)} m³"
            except Exception:
                volume_str = f"{volume_val} m³"
        else:
            volume_str = ""

        # Permissões de trabalho detalhadas
        permissoes_linhas = []
        if pt_manha:
            permissoes_linhas.append(f"• Manhã: {pt_manha}")
        if pt_tarde:
            permissoes_linhas.append(f"• Tarde: {pt_tarde}")
        if pt_noite:
            permissoes_linhas.append(f"• Noite: {pt_noite}")
        if not permissoes_linhas and getattr(rdo_obj, 'exist_pt', None) is not None:
            permissoes_linhas.append(f"• Abertura de PT: {'Sim' if rdo_obj.exist_pt else 'Não'}")

        # Espaço Confinado
        confinado_raw = getattr(rdo_obj, 'confinado', None)
        if confinado_raw is None and first_tank:
            confinado_raw = getattr(first_tank, 'espaco_confinado', None)

        if confinado_raw in (True, 1, 'Sim', 'sim', 'SIM', 's', 'S', 'true', 'True'):
            confinado_str = "SIM"
        elif confinado_raw in (False, 0, 'Não', 'nao', 'NÃO', 'NAO', 'n', 'N', 'false', 'False'):
            confinado_str = "NÃO"
        elif confinado_raw:
            confinado_str = str(confinado_raw).upper()
        else:
            confinado_str = "NÃO"

        def _val_or_tank(field_name, unit=''):
            v = getattr(rdo_obj, field_name, None)
            if v is None and first_tank:
                v = getattr(first_tank, field_name, None)
            if v is None or str(v).strip() == '':
                return ''
            try:
                f = float(v)
                v_str = f"{int(f)}" if f.is_integer() else f"{f}"
            except Exception:
                v_str = str(v).strip()
            return f"{v_str}{unit}" if unit else v_str

        h2s_str = _val_or_tank('h2s_ppm', ' ppm')
        lel_str = _val_or_tank('lel', '%')
        co_str = _val_or_tank('co_ppm', ' ppm')
        o2_str = _val_or_tank('o2_percent', '%')

        # Intervalos de Entrada e Saída
        def _get_interval(ent_field, sai_field, fallback_ent=None, fallback_sai=None):
            e = getattr(rdo_obj, ent_field, None) or (getattr(rdo_obj, fallback_ent, None) if fallback_ent else None)
            s = getattr(rdo_obj, sai_field, None) or (getattr(rdo_obj, fallback_sai, None) if fallback_sai else None)
            e_str = _format_time_val(e)
            s_str = _format_time_val(s)
            if e_str and s_str:
                return f"{e_str} às {s_str}"
            elif e_str:
                return f"{e_str}"
            return ""

        int_1 = _get_interval('entrada_confinado_1', 'saida_confinado_1', 'entrada_confinado', 'saida_confinado')
        int_2 = _get_interval('entrada_confinado_2', 'saida_confinado_2')
        int_3 = _get_interval('entrada_confinado_3', 'saida_confinado_3')
        int_4 = _get_interval('entrada_confinado_4', 'saida_confinado_4')

        op_sim = (
            getattr(rdo_obj, 'operadores_simultaneos', None)
            or (getattr(first_tank, 'operadores_simultaneos', None) if first_tank else None)
            or getattr(rdo_obj, 'total_n_efetivo_confinado', None)
            or ''
        )
        op_sim_str = str(op_sim).strip() if op_sim is not None else ''

        # Equipe Operacional
        equipe_linhas = []
        try:
            membros_qs = getattr(rdo_obj, 'membros_equipe', None)
            if membros_qs and hasattr(membros_qs, 'all') and membros_qs.exists():
                for m in membros_qs.all():
                    nome_m = (
                        getattr(getattr(m, 'pessoa', None), 'nome', None)
                        or getattr(m, 'nome', None)
                        or ''
                    )
                    funcao_m = getattr(m, 'funcao', '') or ''
                    nome_m = str(nome_m).strip()
                    funcao_m = str(funcao_m).strip()
                    if nome_m:
                        if funcao_m:
                            equipe_linhas.append(f"• {nome_m} - {funcao_m}")
                        else:
                            equipe_linhas.append(f"• {nome_m}")
        except Exception:
            pass

        if not equipe_linhas:
            # Fallback para campos textuais de membros
            membros_txt = getattr(rdo_obj, 'membros', '') or ''
            funcoes_txt = getattr(rdo_obj, 'funcoes_list', '') or getattr(rdo_obj, 'funcoes', '') or ''
            if membros_txt:
                try:
                    if membros_txt.startswith('['):
                        m_list = json.loads(membros_txt)
                        f_list = json.loads(funcoes_txt) if funcoes_txt.startswith('[') else []
                        for idx, m_nome in enumerate(m_list):
                            f_nome = f_list[idx] if idx < len(f_list) else ''
                            if str(m_nome).strip():
                                if f_nome:
                                    equipe_linhas.append(f"• {str(m_nome).strip()} - {str(f_nome).strip()}")
                                else:
                                    equipe_linhas.append(f"• {str(m_nome).strip()}")
                    else:
                        for line in membros_txt.splitlines():
                            if line.strip():
                                equipe_linhas.append(f"• {line.strip()}")
                except Exception:
                    pass

        # Horários e Atividades
        atividades_linhas = []
        try:
            ativ_qs = getattr(rdo_obj, 'atividades_rdo', None)
            if ativ_qs and hasattr(ativ_qs, 'all'):
                for atv in ativ_qs.all().order_by('ordem', 'inicio', 'id'):
                    nome_atv = atv.get_atividade_display() if hasattr(atv, 'get_atividade_display') else atv.atividade
                    nome_atv = str(nome_atv or '').strip()
                    if not nome_atv:
                        continue
                    ini_str = _format_time_val(getattr(atv, 'inicio', None))
                    fim_str = _format_time_val(getattr(atv, 'fim', None))
                    comentario = str(getattr(atv, 'comentario_pt', '') or '').strip()

                    horario_str = f"{ini_str} às {fim_str}" if (ini_str and fim_str) else (ini_str or fim_str or '')
                    if horario_str:
                        linha = f"• {horario_str} - {nome_atv}"
                    else:
                        linha = f"• {nome_atv}"

                    if comentario:
                        linha += f" ({comentario})"
                    atividades_linhas.append(linha)
        except Exception:
            pass

        # Observações
        observacoes = (
            getattr(rdo_obj, 'observacoes_rdo_pt', '')
            or getattr(rdo_obj, 'ciente_observacoes_pt', '')
            or ''
        )
        observacoes = str(observacoes).strip()

        # Dados da Operação do Dia
        tempo_bomba_val = (
            getattr(first_tank, 'tempo_bomba', None) if first_tank and getattr(first_tank, 'tempo_bomba', None) is not None
            else getattr(rdo_obj, 'tempo_uso_bomba', None)
        )
        tempo_bomba_str = _format_duration_val(tempo_bomba_val)

        # Se houver distinção manhã/tarde nas atividades, ou valor geral
        bomba_manha_str = tempo_bomba_str if tempo_bomba_str else ''
        bomba_tarde_str = ''

        def _int_or_empty(field_name, tank_field=None):
            v = None
            if first_tank and tank_field:
                v = getattr(first_tank, tank_field, None)
            if v is None:
                v = getattr(rdo_obj, field_name, None)
            if v is None or str(v).strip() == '':
                return ''
            try:
                return str(int(float(v)))
            except Exception:
                return str(v).strip()

        ensacamento_str = _int_or_empty('ensacamento', 'ensacamento_dia')
        tambores_str = _int_or_empty('tambores', 'tambores_dia')
        total_tambores_str = _int_or_empty('total_solidos', 'tambores_cumulativo') or tambores_str
        icamento_str = _int_or_empty('icamento', 'icamento_dia')
        cambagem_str = _int_or_empty('cambagem', 'cambagem_dia')

        # Compartimentos
        comps_raw = (
            getattr(first_tank, 'compartimentos_avanco_json', None) if first_tank and getattr(first_tank, 'compartimentos_avanco_json', None)
            else getattr(rdo_obj, 'compartimentos_avanco_json', None)
        )
        comps_dict = {}
        if comps_raw:
            try:
                comps_dict = json.loads(comps_raw) if isinstance(comps_raw, str) else comps_raw
            except Exception:
                comps_dict = {}

        num_comps = (
            getattr(first_tank, 'numero_compartimentos', None) if first_tank and getattr(first_tank, 'numero_compartimentos', None)
            else getattr(rdo_obj, 'numero_compartimentos', None)
        )
        if not num_comps and comps_dict:
            try:
                valid_keys = [int(k) for k in comps_dict.keys() if str(k).isdigit()]
                if valid_keys:
                    num_comps = max(valid_keys)
            except Exception:
                pass
        if not num_comps or int(num_comps) <= 0:
            num_comps = 10
        else:
            num_comps = int(num_comps)

        # Montagem dos compartimentos de N a 1 (ordem decrescente)
        compartimentos_mecanizada_linhas = []
        compartimentos_fina_linhas = []

        for i in range(num_comps, 0, -1):
            c_info = comps_dict.get(str(i), {})
            if isinstance(c_info, dict):
                mec_val = c_info.get('mecanizada', '')
                fina_val = c_info.get('fina', '')
            else:
                mec_val = c_info
                fina_val = ''

            mec_str = f"{mec_val}%" if str(mec_val).strip() != '' else "%"
            fina_str = f"{fina_val}%" if str(fina_val).strip() != '' else "%"

            compartimentos_mecanizada_linhas.append(f"{i}º → {mec_str}")
            compartimentos_fina_linhas.append(f"{i}º → {fina_str}")

        # Previsão para o próximo turno
        previsao = (
            getattr(rdo_obj, 'planejamento_pt', '')
            or getattr(rdo_obj, 'planejamento_en', '')
            or ''
        )
        previsao = str(previsao).strip()

        # Montagem do esqueleto final com espaçamento idêntico ao solicitado
        permissoes_block = "\n".join(permissoes_linhas) if permissoes_linhas else ""
        equipe_block = "\n".join(equipe_linhas) if equipe_linhas else ""
        atividades_block = "\n".join(atividades_linhas) if atividades_linhas else ""
        comp_mec_block = "\n".join(compartimentos_mecanizada_linhas)
        comp_fina_block = "\n".join(compartimentos_fina_linhas)

        texto = f"""🛠 STATUS OPERACIONAL – {data_str}
 
📄 OS: {numero_os}
📍Unidade: {unidade_nome}
🏗 Cliente: {cliente_nome}
📌 Escopo: {escopo}
PT : {pt_resumo}
TANQUE : {tanque_str}
VOLUME : {volume_str}
 
Permissões de trabalho:
{permissoes_block}
 
🌫 ESPAÇO CONFINADO:({confinado_str})
H₂S: {h2s_str}
LEL: {lel_str}
CO: {co_str}
O₂: {o2_str}
 
Intervalo horário 1ª Entrada e 1ª saída: {int_1}
Intervalo horário 2ª Entrada e 2ª saída: {int_2}
Intervalo horário 3ª Entrada e 3ª saída: {int_3}
Intervalo horário 4ª Entrada e 4ª saída: {int_4}
 
Operadores simultâneos em espaço confinado: {op_sim_str}
 
👷♂ EQUIPE OPERACIONAL
{equipe_block}
 
⏰ HORÁRIOS E ATIVIDADES
{atividades_block}
 
📊 OBSERVAÇÕES:
{observacoes}
 
⚠ DADOS DA OPERAÇÃO DO DIA
 
• Uso da bomba (manhã): {bomba_manha_str}
• Uso da bomba (tarde): {bomba_tarde_str}
• Ensacamento: {ensacamento_str}
• Tambores : {tambores_str}
• Total de tambores: {total_tambores_str}
• Sacos içados: {icamento_str}
 
• Compartimentos já jateados/raspados: (Exemplo com 10 compartimentos. % de avanço para cada compartimento, de forma acumulativa)
{comp_mec_block}
 
• Sacos cambados no turno: {cambagem_str}
 
• Compartimento em limpeza fina: ( Exemplo com 10 compartimentos. Mesma ideia da limpeza mecanizada/raspagem)
{comp_fina_block}
 
🔮 PREVISÃO PARA O PRÓXIMO TURNO:
{previsao}"""

        return texto

    except Exception as e:
        logger.exception("Erro ao gerar texto para WhatsApp do RDO %s", getattr(rdo_obj, 'id', None))
        return f"🛠 STATUS OPERACIONAL\nErro ao gerar texto: {str(e)}"

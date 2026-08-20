document.addEventListener("DOMContentLoaded", () => {
    const STATUS_OPTIONS = [
        "Em Análise",
        "Em Elaboração",
        "Revisada",
        "Enviada",
        "Em Negociação",
        "Fechada/Contratada",
        "Perdida/Recusada",
        "Cancelada",
        "Declínio"
    ];

    const COLUMN_DEFINITIONS = [
        { key: "avaliacao_inicial", label: "Avaliação Inicial", description: "Sem retorno, em análise, avaliando escopo", tone: "analysis" },
        { key: "preparacao_aprovacao", label: "Preparação e Aprovação", description: "Em elaboração, aguardando aprovação", tone: "preparation" },
        { key: "propostas_enviadas", label: "Propostas Enviadas", description: "Revisada, shortlist", tone: "sent" },
        { key: "negociacao", label: "Negociação", description: "Em negociação", tone: "negotiation" },
        { key: "contratadas", label: "Contratadas", description: "Fechadas / Contratadas", tone: "contracted" },
        { key: "canceladas", label: "Canceladas", description: "Propostas canceladas", tone: "cancelled" }
    ];

    const REASON_REQUIRED_STATUSES = new Set(["Perdida/Recusada", "Cancelada", "Declínio"]);
    const RESPONSAVEIS = ["Carla Mendes", "Rafael Lima", "Juliana Costa", "Lucas Freitas", "Beatriz Nunes", "Marcos Silva"];
    const NATUREZAS = ["Onshore", "Offshore", "Serviço"];
    const HEATMAPS = ["1 - Baixo", "2 - Médio", "3 - Alto"];
    const UFS = ["RJ", "ES", "SP", "SC"];
    const FONTE_LEAD = ["Relacionamento direto", "Indicação", "Licitação", "Lead inbound", "Cliente recorrente"];
    const SEGMENTOS = ["Petróleo e Gás", "Mineração", "Energia", "Logística Offshore"];
    const FOLLOWUP_TYPES = ["Ligação", "E-mail", "WhatsApp", "Reunião", "Retorno do cliente", "Atualização interna", "Outro"];
    const FOLLOWUP_STATUSES = ["Pendente", "Realizado", "Sem retorno", "Reagendado"];
    const CRITICAL_ANALYSIS_FIELDS = [
        "capacidade_atender_requisitos", "habilitacao_tecnica_atendida", "visita_tecnica_necessaria",
        "escopo_claramente_definido", "competencia_tecnica_execucao", "recursos_disponiveis",
        "equipe_com_treinamentos", "equipe_irata_disponivel", "equipe_resgate_disponivel",
        "tempo_habil_mobilizacao", "tempo_habil_aquisicao", "riscos_comerciais_relevantes",
        "oportunidade_viavel_rentavel", "pendencias_financeiras_cliente", "iremos_participar"
    ];
    const CRITICAL_ANALYSIS_OPTIONS = [
        { value: "SIM", label: "Sim" },
        { value: "NAO", label: "Não" },
        { value: "NA", label: "NA" }
    ];
    const AGENDA_RESPONSAVEIS = ["Todos", "Rafael Lima", "Carla Mendes", "Lucas Freitas", "Beatriz Nunes", "Juliana Costa", "Marcos Silva", "Camila Souza"];
    const MOTIVO_OPTIONS = [
        "Selecione o motivo",
        "Aguardando retorno do cliente",
        "Perda por preço",
        "Escopo cancelado",
        "Mudança de prioridade do cliente",
        "Sem aderência técnica",
        "Sem budget aprovado"
    ];

    STATUS_OPTIONS.splice(0, STATUS_OPTIONS.length, ...[
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
        "Aguardando aprovação gestores"
    ]);

    REASON_REQUIRED_STATUSES.clear();
    ["Perdida/Recusada", "Cancelada", "Declínio"].forEach((status) => REASON_REQUIRED_STATUSES.add(status));

    RESPONSAVEIS.splice(0, RESPONSAVEIS.length, ...[
        "Daniel Cunha",
        "Rafael Pariz",
        "Katlyn Brito",
        "Sabryna Montoro",
        "Marcos Franca",
        "Felipe Segundo",
        "Fernanda Braz"
    ]);

    NATUREZAS.splice(0, NATUREZAS.length, ...[
        "Aditivo",
        "Reajuste",
        "Spot",
        "Contrato Novo",
        "Renovação"
    ]);

    HEATMAPS.splice(0, HEATMAPS.length, ..."0,1,2,3".split(","));
    FONTE_LEAD.splice(0, FONTE_LEAD.length, ..."Portal Group,Vendas Ambipar,Cross Shell,Convite Direto,Prospecção Ativa".split(","));
    SEGMENTOS.splice(0, SEGMENTOS.length, ..."Petróleo e Gás,Mineração,Energia,Logística Offshore".split(","));

    const state = {
        search: "",
        filtersOpen: false,
        filterNumero: "",
        filterStatus: "",
        filterNatureza: "",
        filterStatusProposta: "",
        filterTipoOperacao: "",
        filterResponsavel: "",
        filterCliente: "",
        filterUnidade: "",
        filterUf: "",
        filterSegmentoCliente: "",
        filterFonteLead: "",
        filterHeatMap: "",
        filterMotivoPerda: "",
        filterPrazo: "",
        focusedStage: "",
        kpiFilter: "",
        focusedPage: 1,
        focusedItemsPerPage: 6,
        pipelineError: false,
        followupsError: false,
        connectionError: false,
        saveProposalError: false,
        createProposalError: false,
        createProposalErrorFields: {},
        agendaSearch: "",
        agendaResponsavel: "Todos",
        agendaStatus: "Todos",
        agendaPeriod: "",
        agendaDefaultPeriod: "",
        agendaPage: 1,
        agendaPerPage: 10,
        agendaSelectedDate: "",
        agendaDayFocus: "",
        agendaLoading: false,
        agendaLoaded: false,
        agendaCanViewAll: false,
        agendaCreateOpen: false,
        agendaTotalAll: 0,
        agendaSummary: null,
        agendaCalendarDays: [],
        agendaResponsavelOptions: ["Todos"],
        agendaStatusOptions: ["Todos", ...FOLLOWUP_STATUSES],
        selectedProposalId: null,
        activeDetailTab: "resumo",
        dataEditMode: false,
        criticalAnalysisEditMode: false,
        scopeEditMode: false,
        noteEditMode: false,
        followupFormOpen: false,
        statusError: false,
        focusStatusSection: false,
        modalStep: 1,
        criticalAnalysisAnswers: {},
        nextProposalNumber: 1,
        proposalItems: [],
        proposalDraftServices: [""],
        scopeDraftServices: [],
        scopeDraftItems: [],
        scopeQuickItemOpen: false,
        proposalItemCounter: 1,
        lastCreatedProposalPayload: null,
        toastTimer: null,
        pipelineTransitionTimer: null,
        loadingTimers: []
    };

    const PROPOSAL_ITEM_GROUPS = [
        {
            label: "Serviço",
            options: [
                "Serviço de Limpeza de Tanques"
            ]
        },
        {
            label: "Equipamentos e Taxas",
            options: [
                "Ventilador ou Exaustor",
                "Bomba Pneumática",
                "Conjunto de Painel Elétrico",
                "Conjunto de Luminárias Elétricas",
                "Conjunto de Luminárias Pneumáticas",
                "Ar Condicionado",
                "Compressor de Ar",
                "Tank Scope",
                "Kit Resgate 1",
                "Kit Resgate 2",
                "Conjunto de Equipamentos para Limpeza Mecanizada",
                "Taxa Diária de Dispon. de Equip. para Limpeza Mecanizada Onshore",
                "Taxa Mensal de Equipe Onshore",
                "Taxa Diária Superv. de Serviço de Limpeza ou Operador à Disposição",
                "Taxa Diária de Auxiliar de Serviços Gerais de Limpeza à Disposição",
                "Taxa de Monitoramento de Saúde"
            ]
        }
    ];

    const kpis = [
        { icon: "description", title: "Total de Propostas", value: "0", filterType: "all" },
        { icon: "payments", title: "Receita Estimada Total", value: "R$ 0,00" },
        { icon: "calendar_month", title: "Propostas no Mês", value: "0", filterType: "propostas-mes" },
        { icon: "approval", title: "Aguardando Aprovação", value: "0", filterType: "aguardando-aprovacao", attention: true },
        { icon: "check_circle", title: "Contratadas", value: "0", filterType: "contratadas" },
        { icon: "cancel", title: "Canceladas", value: "0", filterType: "canceladas" }
    ];

    const revenueByStage = [
        { label: "Em Análise", value: "R$ 8,08 mi", amount: 8.08, highlight: false },
        { label: "Em Elaboração", value: "R$ 6,76 mi", amount: 6.76, highlight: false },
        { label: "Enviadas", value: "R$ 7,93 mi", amount: 7.93, highlight: false },
        { label: "Em Negociação", value: "R$ 10,05 mi", amount: 10.05, highlight: false },
        { label: "Fechadas", value: "R$ 13,62 mi", amount: 13.62, highlight: true }
    ];

    const proposals = [
        createProposal(1, {
            numeroProposta: "PRO-2026-011",
            rev: "02",
            emissao: "05/07/2026",
            emissaoMes: "07",
            responsavel: "Carla Mendes",
            dataEntregaProposta: "05/07/2026",
            dataSolicitacaoProposta: "03/07/2026",
            dataFechamento: "",
            previsaoContratacao: "28/07/2026",
            followUp: "10/07/2026",
            natureza: "Onshore",
            unidade: "Base Rio",
            heatMap: "1 - Baixo",
            statusProposta: "Em Análise",
            motivoDeclinioPerda: "",
            analiseCriticaRealizada: "Sim",
            pt: "Elaborada",
            pcPtc: "Elaborada",
            empresa: "PetroCoast Offshore",
            uf: "RJ",
            embarcacaoLocal: "Base Rio",
            escopo: "Limpeza de tanques de armazenamento de óleo combustível, incluindo descontaminação, gestão de resíduos e emissão de certificados.",
            estimativaReceita: "R$ 3.250.000",
            tempoContratoDias: "180 dias",
            solicitante: "João Silva",
            fonteLead: "Relacionamento direto",
            comentario: "Proposta com boa aderência ao escopo. Cliente solicita ajuste no prazo de execução.",
            segmentoCliente: "Petróleo e Gás",
            followUps: [
                { data: "07/07/2026", hora: "10:00", responsavel: "Rafael Lima", tipoContato: "Reunião", comentario: "Reunião técnica com cliente para alinhamento do escopo e prazos.", proximaAcao: "Retornar com cronograma executivo revisado", dataProximaAcao: "10/07/2026", status: "Pendente" },
                { data: "08/07/2026", hora: "15:30", responsavel: "Carla Mendes", tipoContato: "E-mail", comentario: "Envio de premissas e documentação complementar.", proximaAcao: "Confirmar recebimento da documentação", dataProximaAcao: "11/07/2026", status: "Realizado" }
            ],
            historico: [
                { dataHora: "05/07/2026 09:00", usuario: "Carla Mendes", acao: "Proposta criada", detalhe: "Cadastro inicial da proposta comercial." },
                { dataHora: "07/07/2026 10:15", usuario: "Carla Mendes", acao: "Status alterado", detalhe: "Status atualizado para Em Análise." },
                { dataHora: "08/07/2026 15:30", usuario: "Rafael Lima", acao: "Follow-up registrado", detalhe: "Envio de documentação complementar ao cliente." }
            ]
        }),
        createProposal(2, {
            numeroProposta: "PRO-2026-010",
            rev: "01",
            emissao: "03/07/2026",
            emissaoMes: "07",
            responsavel: "Rafael Lima",
            dataEntregaProposta: "03/07/2026",
            dataSolicitacaoProposta: "30/06/2026",
            dataFechamento: "",
            previsaoContratacao: "25/07/2026",
            followUp: "09/07/2026",
            natureza: "Onshore",
            unidade: "Vitória",
            heatMap: "2 - Médio",
            statusProposta: "Em Análise",
            motivoDeclinioPerda: "",
            analiseCriticaRealizada: "Sim",
            pt: "Em revisão",
            pcPtc: "Em revisão",
            empresa: "Vale do Aço Mineração",
            uf: "ES",
            embarcacaoLocal: "Terminal Vitória",
            escopo: "Suporte operacional para limpeza industrial e gestão ambiental em área portuária.",
            estimativaReceita: "R$ 1.850.000",
            tempoContratoDias: "90 dias",
            solicitante: "Patrícia Alves",
            fonteLead: "Indicação",
            comentario: "Cliente pediu composição alternativa de equipe.",
            segmentoCliente: "Mineração"
        }),
        createProposal(3, {
            numeroProposta: "PRO-2026-006",
            rev: "03",
            emissao: "01/07/2026",
            emissaoMes: "07",
            responsavel: "Juliana Costa",
            dataEntregaProposta: "01/07/2026",
            dataSolicitacaoProposta: "27/06/2026",
            dataFechamento: "",
            previsaoContratacao: "20/07/2026",
            followUp: "10/07/2026",
            natureza: "Offshore",
            unidade: "Santos",
            heatMap: "2 - Médio",
            statusProposta: "Em Análise",
            motivoDeclinioPerda: "",
            analiseCriticaRealizada: "Não",
            pt: "Pendente",
            pcPtc: "Pendente",
            empresa: "SBM do Brasil",
            uf: "SP",
            embarcacaoLocal: "FPSO Santos",
            escopo: "Apoio embarcado para descontaminação, limpeza técnica e descarte controlado.",
            estimativaReceita: "R$ 2.980.000",
            tempoContratoDias: "120 dias",
            solicitante: "Maurício Prado",
            fonteLead: "Cliente recorrente",
            comentario: "Necessita validação final de mobilização."
        }),
        createProposal(4, {
            numeroProposta: "PRO-2026-012",
            rev: "01",
            emissao: "10/07/2026",
            emissaoMes: "07",
            responsavel: "Lucas Freitas",
            dataEntregaProposta: "10/07/2026",
            dataSolicitacaoProposta: "07/07/2026",
            dataFechamento: "",
            previsaoContratacao: "02/08/2026",
            followUp: "08/07/2026",
            natureza: "Onshore",
            unidade: "Macaé",
            heatMap: "2 - Médio",
            statusProposta: "Em Elaboração",
            motivoDeclinioPerda: "",
            analiseCriticaRealizada: "Sim",
            pt: "Em elaboração",
            pcPtc: "Em elaboração",
            empresa: "Modec Serviços",
            uf: "RJ",
            embarcacaoLocal: "Base Macaé",
            escopo: "Proposta de apoio à manutenção, limpeza industrial e gerenciamento de resíduos em base logística.",
            estimativaReceita: "R$ 4.210.000",
            tempoContratoDias: "240 dias",
            solicitante: "Bruno Castro",
            fonteLead: "Relacionamento direto",
            comentario: "Cliente quer fechamento até início de agosto."
        }),
        createProposal(5, {
            numeroProposta: "PRO-2026-013",
            rev: "00",
            emissao: "12/07/2026",
            emissaoMes: "07",
            responsavel: "Beatriz Nunes",
            dataEntregaProposta: "12/07/2026",
            dataSolicitacaoProposta: "09/07/2026",
            dataFechamento: "",
            previsaoContratacao: "05/08/2026",
            followUp: "13/07/2026",
            natureza: "Offshore",
            unidade: "Rio das Ostras",
            heatMap: "1 - Baixo",
            statusProposta: "Em Elaboração",
            motivoDeclinioPerda: "",
            analiseCriticaRealizada: "Não",
            pt: "Pendente",
            pcPtc: "Pendente",
            empresa: "Seadrill",
            uf: "RJ",
            embarcacaoLocal: "Rio das Ostras",
            escopo: "Mobilização de equipe embarcada para atendimento offshore e suporte ambiental.",
            estimativaReceita: "R$ 2.150.000",
            tempoContratoDias: "75 dias",
            solicitante: "Natália Freire",
            fonteLead: "Lead inbound",
            comentario: "Escopo ainda em composição comercial."
        }),
        createProposal(6, {
            numeroProposta: "PRO-2026-014",
            rev: "00",
            emissao: "15/07/2026",
            emissaoMes: "07",
            responsavel: "Marcos Silva",
            dataEntregaProposta: "15/07/2026",
            dataSolicitacaoProposta: "11/07/2026",
            dataFechamento: "",
            previsaoContratacao: "09/08/2026",
            followUp: "14/07/2026",
            natureza: "Onshore",
            unidade: "Niterói",
            heatMap: "1 - Baixo",
            statusProposta: "Em Elaboração",
            motivoDeclinioPerda: "",
            analiseCriticaRealizada: "Não",
            pt: "Pendente",
            pcPtc: "Pendente",
            empresa: "West Polaris",
            uf: "RJ",
            embarcacaoLocal: "Terminal Niterói",
            escopo: "Atendimento em terminal com equipe técnica dedicada e gestão de destinação ambiental.",
            estimativaReceita: "R$ 1.420.000",
            tempoContratoDias: "60 dias",
            solicitante: "Ricardo Teles",
            fonteLead: "Indicação",
            comentario: "Dependente de aprovação de premissas."
        }),
        createProposal(7, {
            numeroProposta: "PRO-2026-008",
            rev: "03",
            emissao: "28/06/2026",
            emissaoMes: "06",
            responsavel: "Rafael Lima",
            dataEntregaProposta: "28/06/2026",
            dataSolicitacaoProposta: "24/06/2026",
            dataFechamento: "",
            previsaoContratacao: "18/07/2026",
            followUp: "07/07/2026",
            natureza: "Onshore",
            unidade: "Campos",
            heatMap: "3 - Alto",
            statusProposta: "Enviada",
            motivoDeclinioPerda: "",
            analiseCriticaRealizada: "Sim",
            pt: "Concluída",
            pcPtc: "Concluída",
            empresa: "Petrobras - P-74",
            uf: "RJ",
            embarcacaoLocal: "P-74",
            escopo: "Plano completo para operação offshore com foco em resposta rápida e gestão de resíduos.",
            estimativaReceita: "R$ 5.600.000",
            tempoContratoDias: "365 dias",
            solicitante: "Roberta Sampaio",
            fonteLead: "Cliente recorrente",
            comentario: "Aguardando reunião técnica final.",
            followUps: [
                { data: "07/07/2026", hora: "10:00", responsavel: "Rafael Lima", tipoContato: "Reunião", comentario: "Reunião técnica agendada com engenharia do cliente.", proximaAcao: "Enviar ata e ajustes comerciais", dataProximaAcao: "10/07/2026", status: "Pendente" }
            ]
        }),
        createProposal(8, {
            numeroProposta: "PRO-2026-007",
            rev: "02",
            emissao: "24/06/2026",
            emissaoMes: "06",
            responsavel: "Juliana Costa",
            dataEntregaProposta: "24/06/2026",
            dataSolicitacaoProposta: "19/06/2026",
            dataFechamento: "",
            previsaoContratacao: "20/07/2026",
            followUp: "11/07/2026",
            natureza: "Offshore",
            unidade: "Santos",
            heatMap: "2 - Médio",
            statusProposta: "Enviada",
            motivoDeclinioPerda: "",
            analiseCriticaRealizada: "Sim",
            pt: "Concluída",
            pcPtc: "Concluída",
            empresa: "SBM do Brasil",
            uf: "SP",
            embarcacaoLocal: "FPSO Santos",
            escopo: "Escopo offshore com equipe embarcada e estrutura dedicada de apoio ambiental.",
            estimativaReceita: "R$ 2.750.000",
            tempoContratoDias: "150 dias",
            solicitante: "Felipe Matos",
            fonteLead: "Relacionamento direto",
            comentario: "Cliente em análise interna."
        }),
        createProposal(9, {
            numeroProposta: "PRO-2026-005",
            rev: "02",
            emissao: "22/06/2026",
            emissaoMes: "06",
            responsavel: "Lucas Freitas",
            dataEntregaProposta: "22/06/2026",
            dataSolicitacaoProposta: "18/06/2026",
            dataFechamento: "",
            previsaoContratacao: "24/07/2026",
            followUp: "12/07/2026",
            natureza: "Onshore",
            unidade: "Angra",
            heatMap: "2 - Médio",
            statusProposta: "Enviada",
            motivoDeclinioPerda: "",
            analiseCriticaRealizada: "Sim",
            pt: "Concluída",
            pcPtc: "Concluída",
            empresa: "FPSO Cidade de Paraty",
            uf: "RJ",
            embarcacaoLocal: "Angra",
            escopo: "Atendimento para limpeza industrial e suporte técnico de bordo.",
            estimativaReceita: "R$ 3.180.000",
            tempoContratoDias: "120 dias",
            solicitante: "Fernanda Lopes",
            fonteLead: "Cliente recorrente",
            comentario: "Cliente pediu reforço em plano de contingência."
        }),
        createProposal(10, {
            numeroProposta: "PRO-2026-003",
            rev: "04",
            emissao: "18/06/2026",
            emissaoMes: "06",
            responsavel: "Carla Mendes",
            dataEntregaProposta: "18/06/2026",
            dataSolicitacaoProposta: "14/06/2026",
            dataFechamento: "",
            previsaoContratacao: "21/07/2026",
            followUp: "09/07/2026",
            natureza: "Offshore",
            unidade: "Campos",
            heatMap: "3 - Alto",
            statusProposta: "Em Negociação",
            motivoDeclinioPerda: "",
            analiseCriticaRealizada: "Sim",
            pt: "Concluída",
            pcPtc: "Concluída",
            empresa: "Petrobras - P-79",
            uf: "RJ",
            embarcacaoLocal: "P-79",
            escopo: "Negociação final para pacote anual de serviços offshore com operação contínua.",
            estimativaReceita: "R$ 6.800.000",
            tempoContratoDias: "365 dias",
            solicitante: "Daniela Cruz",
            fonteLead: "Cliente recorrente",
            comentario: "Negociação na fase final de aprovações.",
            followUps: [
                { data: "09/07/2026", hora: "09:30", responsavel: "Carla Mendes", tipoContato: "Reunião", comentario: "Negociação final com suprimentos do cliente.", proximaAcao: "Receber retorno final da diretoria", dataProximaAcao: "11/07/2026", status: "Pendente" }
            ]
        }),
        createProposal(11, {
            numeroProposta: "PRO-2026-002",
            rev: "03",
            emissao: "17/06/2026",
            emissaoMes: "06",
            responsavel: "Beatriz Nunes",
            dataEntregaProposta: "17/06/2026",
            dataSolicitacaoProposta: "13/06/2026",
            dataFechamento: "",
            previsaoContratacao: "19/07/2026",
            followUp: "10/07/2026",
            natureza: "Offshore",
            unidade: "Vitória",
            heatMap: "2 - Médio",
            statusProposta: "Em Negociação",
            motivoDeclinioPerda: "",
            analiseCriticaRealizada: "Sim",
            pt: "Concluída",
            pcPtc: "Concluída",
            empresa: "FPSO Espírito Santo",
            uf: "ES",
            embarcacaoLocal: "Espírito Santo",
            escopo: "Proposta para apoio offshore com mobilização rápida e operação dedicada.",
            estimativaReceita: "R$ 4.300.000",
            tempoContratoDias: "240 dias",
            solicitante: "Carlos Viana",
            fonteLead: "Indicação",
            comentario: "Cliente solicitou revisão de SLA."
        }),
        createProposal(12, {
            numeroProposta: "PRO-2026-001",
            rev: "02",
            emissao: "16/06/2026",
            emissaoMes: "06",
            responsavel: "Marcos Silva",
            dataEntregaProposta: "16/06/2026",
            dataSolicitacaoProposta: "12/06/2026",
            dataFechamento: "",
            previsaoContratacao: "22/07/2026",
            followUp: "11/07/2026",
            natureza: "Onshore",
            unidade: "Macaé",
            heatMap: "2 - Médio",
            statusProposta: "Em Negociação",
            motivoDeclinioPerda: "",
            analiseCriticaRealizada: "Sim",
            pt: "Concluída",
            pcPtc: "Concluída",
            empresa: "Petrobras - P-76",
            uf: "RJ",
            embarcacaoLocal: "P-76",
            escopo: "Atendimento onshore com equipe dedicada e suporte operacional 24x7.",
            estimativaReceita: "R$ 2.950.000",
            tempoContratoDias: "180 dias",
            solicitante: "Lívia Duarte",
            fonteLead: "Relacionamento direto",
            comentario: "Dependente de aprovação orçamentária."
        }),
        createProposal(13, {
            numeroProposta: "PRO-2026-004",
            rev: "04",
            emissao: "14/06/2026",
            emissaoMes: "06",
            responsavel: "Rafael Lima",
            dataEntregaProposta: "14/06/2026",
            dataSolicitacaoProposta: "10/06/2026",
            dataFechamento: "18/06/2026",
            previsaoContratacao: "18/06/2026",
            followUp: "Contrato assinado",
            natureza: "Offshore",
            unidade: "Santos",
            heatMap: "3 - Alto",
            statusProposta: "Fechada/Contratada",
            motivoDeclinioPerda: "",
            analiseCriticaRealizada: "Sim",
            pt: "Aprovada",
            pcPtc: "Aprovada",
            empresa: "Brava Energia",
            uf: "SP",
            embarcacaoLocal: "Santos",
            escopo: "Contrato fechado para operação offshore com atendimento contínuo e equipe embarcada.",
            estimativaReceita: "R$ 7.450.000",
            tempoContratoDias: "365 dias",
            solicitante: "Fabiana Rocha",
            fonteLead: "Cliente recorrente",
            comentario: "Proposta convertida com ótima margem."
        }),
        createProposal(14, {
            numeroProposta: "PRO-2026-009",
            rev: "03",
            emissao: "11/06/2026",
            emissaoMes: "06",
            responsavel: "Carla Mendes",
            dataEntregaProposta: "11/06/2026",
            dataSolicitacaoProposta: "07/06/2026",
            dataFechamento: "15/06/2026",
            previsaoContratacao: "15/06/2026",
            followUp: "Contrato assinado",
            natureza: "Onshore",
            unidade: "Campos",
            heatMap: "3 - Alto",
            statusProposta: "Fechada/Contratada",
            motivoDeclinioPerda: "",
            analiseCriticaRealizada: "Sim",
            pt: "Aprovada",
            pcPtc: "Aprovada",
            empresa: "Petrobras - P-70",
            uf: "RJ",
            embarcacaoLocal: "P-70",
            escopo: "Pacote contratado para atendimento industrial e ambiental em unidade onshore.",
            estimativaReceita: "R$ 5.200.000",
            tempoContratoDias: "270 dias",
            solicitante: "Amanda Nogueira",
            fonteLead: "Cliente recorrente",
            comentario: "Contrato concluído dentro do prazo esperado."
        }),
        createProposal(15, {
            numeroProposta: "PRO-2026-015",
            rev: "01",
            emissao: "08/06/2026",
            emissaoMes: "06",
            responsavel: "Juliana Costa",
            dataEntregaProposta: "08/06/2026",
            dataSolicitacaoProposta: "04/06/2026",
            dataFechamento: "12/06/2026",
            previsaoContratacao: "12/06/2026",
            followUp: "Contrato assinado",
            natureza: "Offshore",
            unidade: "Itajaí",
            heatMap: "2 - Médio",
            statusProposta: "Fechada/Contratada",
            motivoDeclinioPerda: "",
            analiseCriticaRealizada: "Sim",
            pt: "Aprovada",
            pcPtc: "Aprovada",
            empresa: "AquaMarine",
            uf: "SC",
            embarcacaoLocal: "Itajaí",
            escopo: "Atendimento offshore contratado com suporte técnico e mobilização dedicada.",
            estimativaReceita: "R$ 3.900.000",
            tempoContratoDias: "210 dias",
            solicitante: "Gustavo Mello",
            fonteLead: "Indicação",
            comentario: "Cliente sinalizou interesse em expansão futura."
        })
    ];

    let agendaFollowups = [];

    const refs = {
        globalSearchInput: document.getElementById("globalSearchInput"),
        toggleFilters: document.getElementById("toggleFilters"),
        filtersPanel: document.getElementById("filtersPanel"),
        filterNumero: document.getElementById("filterNumero"),
        filterStatus: document.getElementById("filterStatus"),
        filterNatureza: document.getElementById("filterNatureza"),
        filterStatusProposta: document.getElementById("filterStatusProposta"),
        filterTipoOperacao: document.getElementById("filterTipoOperacao"),
        filterResponsavel: document.getElementById("filterResponsavel"),
        filterCliente: document.getElementById("filterCliente"),
        filterUnidade: document.getElementById("filterUnidade"),
        filterUf: document.getElementById("filterUf"),
        filterSegmentoCliente: document.getElementById("filterSegmentoCliente"),
        filterFonteLead: document.getElementById("filterFonteLead"),
        filterHeatMap: document.getElementById("filterHeatMap"),
        filterMotivoPerda: document.getElementById("filterMotivoPerda"),
        filterPrazo: document.getElementById("filterPrazo"),
        clearFiltersButton: document.getElementById("clearFiltersButton"),
        kpiStrip: document.getElementById("kpiStrip"),
        kpiFilterNotice: document.getElementById("kpiFilterNotice"),
        pipelineBoard: document.getElementById("pipelineBoard"),
        revenueBars: document.getElementById("revenueBars"),
        upcomingFollowupsList: document.getElementById("upcomingFollowupsList"),
        contentGrid: document.getElementById("contentGrid"),
        sidebarStack: document.getElementById("sidebarStack"),
        quickActionsList: document.getElementById("quickActionsList"),
        proposalItemsList: document.getElementById("proposalItemsList"),
        proposalItemsTotalValue: document.getElementById("proposalItemsTotalValue"),
        overlayBackdrop: document.getElementById("overlayBackdrop"),
        proposalDrawer: document.getElementById("proposalDrawer"),
        newProposalModal: document.getElementById("newProposalModal"),
        fullFollowupAgendaModal: document.getElementById("fullFollowupAgendaModal"),
        openNewProposalModal: document.getElementById("openNewProposalModal"),
        proposalStepper: document.getElementById("proposalStepper"),
        proposalPrevButton: document.getElementById("proposalPrevButton"),
        proposalCancelButton: document.getElementById("proposalCancelButton"),
        proposalDraftButton: document.getElementById("proposalDraftButton"),
        proposalNextButton: document.getElementById("proposalNextButton"),
        proposalSubmitButton: document.getElementById("proposalSubmitButton"),
        proposalModalAlert: document.getElementById("proposalModalAlert"),
        proposalModalFeedback: document.getElementById("proposalModalFeedback"),
        proposalNumero: document.getElementById("proposalNumero"),
        proposalCliente: document.getElementById("proposalCliente"),
        proposalUnidade: document.getElementById("proposalUnidade"),
        openQuickClientFormButton: document.getElementById("openQuickClientFormButton"),
        cancelQuickClientFormButton: document.getElementById("cancelQuickClientFormButton"),
        saveQuickClientButton: document.getElementById("saveQuickClientButton"),
        quickClientForm: document.getElementById("quickClientForm"),
        quickClientName: document.getElementById("quickClientName"),
        openQuickUnitFormButton: document.getElementById("openQuickUnitFormButton"),
        cancelQuickUnitFormButton: document.getElementById("cancelQuickUnitFormButton"),
        saveQuickUnitButton: document.getElementById("saveQuickUnitButton"),
        quickUnitForm: document.getElementById("quickUnitForm"),
        quickUnitName: document.getElementById("quickUnitName"),
        quickUnitClientHint: document.getElementById("quickUnitClientHint"),
        openQuickMethodFormButton: document.getElementById("openQuickMethodFormButton"),
        cancelQuickMethodFormButton: document.getElementById("cancelQuickMethodFormButton"),
        saveQuickMethodButton: document.getElementById("saveQuickMethodButton"),
        quickMethodForm: document.getElementById("quickMethodForm"),
        quickMethodName: document.getElementById("quickMethodName"),
        openQuickServiceFormButton: document.getElementById("openQuickServiceFormButton"),
        cancelQuickServiceFormButton: document.getElementById("cancelQuickServiceFormButton"),
        saveQuickServiceButton: document.getElementById("saveQuickServiceButton"),
        quickServiceForm: document.getElementById("quickServiceForm"),
        quickServiceName: document.getElementById("quickServiceName"),
        openQuickItemFormButton: document.getElementById("openQuickItemFormButton"),
        cancelQuickItemFormButton: document.getElementById("cancelQuickItemFormButton"),
        saveQuickItemButton: document.getElementById("saveQuickItemButton"),
        quickItemForm: document.getElementById("quickItemForm"),
        quickItemName: document.getElementById("quickItemName"),
        openQuickSegmentFormButton: document.getElementById("openQuickSegmentFormButton"),
        cancelQuickSegmentFormButton: document.getElementById("cancelQuickSegmentFormButton"),
        saveQuickSegmentButton: document.getElementById("saveQuickSegmentButton"),
        quickSegmentForm: document.getElementById("quickSegmentForm"),
        quickSegmentName: document.getElementById("quickSegmentName"),
        comercialLoadingScreen: document.getElementById("comercialLoadingScreen"),
        commercialNotifications: document.getElementById("commercialNotifications"),
        commercialBottomToast: document.getElementById("commercialBottomToast")
    };

    const commercialBootstrap = readCommercialBootstrap();

    const modalFieldsByStep = {
        1: [],
        2: ["proposalRev", "proposalEmissao", "proposalResponsavel", "proposalNatureza", "proposalHeatMap"],
        3: ["proposalCliente", "proposalUnidade", "proposalTipoOperacao", "proposalDataSolicitacao", "proposalDataEntrega"],
        4: ["proposalServico", "proposalReceita"],
        5: ["proposalStatus"]
    };

    applyBootstrapData(commercialBootstrap);
    hydrateFilters();
    hydrateCommercialFormOptions();
    resetProposalItemsState();
    bindEvents();
    renderAll();
    loadFollowups().then(renderUpcomingFollowups);
    renderProposalItemsSection();
    updateModalStep();
    simulateComercialLoading();
    initErrorMocks();
    const directProposalId = Number(new URLSearchParams(window.location.search).get("proposta"));
    if (directProposalId) {
        openProposalPanel(directProposalId);
    }

    function bindEvents() {
        refs.globalSearchInput.addEventListener("input", (event) => {
            state.search = event.target.value.trim().toLowerCase();
            renderPipeline();
        });

        refs.pipelineBoard?.addEventListener("click", (event) => {
            const createFirstProposalTrigger = event.target.closest("[data-open-first-proposal]");
            if (createFirstProposalTrigger) {
                event.preventDefault();
                openProposalModal();
                return;
            }

            const seeAllTrigger = event.target.closest("[data-see-all-stage]");
            if (seeAllTrigger) {
                event.preventDefault();
                event.stopPropagation();
                openFocusedStageView(seeAllTrigger.dataset.seeAllStage);
                return;
            }

            const backToAllTrigger = event.target.closest("[data-back-all-stages]");
            if (backToAllTrigger) {
                event.preventDefault();
                event.stopPropagation();
                if (state.kpiFilter) {
                    clearKpiFilter();
                } else {
                    state.focusedStage = "";
                    state.focusedPage = 1;
                    renderPipeline();
                }
                return;
            }

            const focusedPageTrigger = event.target.closest("[data-focused-page]");
            if (focusedPageTrigger) {
                event.preventDefault();
                event.stopPropagation();
                const nextPage = Number(focusedPageTrigger.dataset.focusedPage);
                if (nextPage) {
                    goToFilteredPage(nextPage);
                }
            }
        });

        refs.proposalItemsList?.addEventListener("click", (event) => {
            const removeTrigger = event.target.closest("[data-proposal-item-remove]");
            if (removeTrigger) {
                event.preventDefault();
                removeProposalItemRow(Number(removeTrigger.dataset.proposalItemRemove));
            }
        });

        refs.toggleFilters.addEventListener("click", () => {
            state.filtersOpen = !state.filtersOpen;
            refs.filtersPanel.classList.toggle("is-hidden", !state.filtersOpen);
        });

        refs.filterNumero.addEventListener("input", (event) => {
            state.filterNumero = event.target.value.trim().toLowerCase();
            renderPipeline();
        });

        refs.filterStatus.addEventListener("change", (event) => {
            state.filterStatus = event.target.value;
            renderPipeline();
            if (state.filterStatus) {
                showNotification({
                    type: "info",
                    title: "Filtro aplicado",
                    message: `Exibindo apenas propostas com status ${state.filterStatus}.`
                });
            }
        });

        refs.filterNatureza.addEventListener("change", (event) => {
            state.filterNatureza = event.target.value;
            renderPipeline();
        });

        refs.filterStatusProposta.addEventListener("change", (event) => {
            state.filterStatusProposta = event.target.value;
            renderPipeline();
        });

        refs.filterTipoOperacao.addEventListener("change", (event) => {
            state.filterTipoOperacao = event.target.value;
            renderPipeline();
        });

        refs.filterResponsavel.addEventListener("change", (event) => {
            state.filterResponsavel = event.target.value;
            renderPipeline();
        });

        refs.filterCliente.addEventListener("input", (event) => {
            state.filterCliente = event.target.value.trim().toLowerCase();
            renderPipeline();
        });

        refs.filterUnidade.addEventListener("input", (event) => {
            state.filterUnidade = event.target.value.trim().toLowerCase();
            renderPipeline();
        });

        refs.filterUf.addEventListener("change", (event) => {
            state.filterUf = event.target.value;
            renderPipeline();
        });

        refs.filterSegmentoCliente.addEventListener("change", (event) => {
            state.filterSegmentoCliente = event.target.value;
            renderPipeline();
        });

        refs.filterFonteLead.addEventListener("change", (event) => {
            state.filterFonteLead = event.target.value;
            renderPipeline();
        });

        refs.filterHeatMap.addEventListener("change", (event) => {
            state.filterHeatMap = event.target.value;
            renderPipeline();
        });

        refs.filterMotivoPerda.addEventListener("change", (event) => {
            state.filterMotivoPerda = event.target.value;
            renderPipeline();
        });

        refs.filterPrazo.addEventListener("change", (event) => {
            state.filterPrazo = event.target.value;
            renderPipeline();
        });

        refs.clearFiltersButton?.addEventListener("click", clearComercialFilters);

        refs.kpiStrip.addEventListener("click", (event) => {
            const trigger = event.target.closest("[data-kpi-filter]");
            if (!trigger) {
                return;
            }

            applyKpiFilter(trigger.dataset.kpiFilter);
        });

        refs.kpiStrip.addEventListener("keydown", (event) => {
            const trigger = event.target.closest("[data-kpi-filter]");
            if (!trigger || (event.key !== "Enter" && event.key !== " ")) {
                return;
            }

            event.preventDefault();
            applyKpiFilter(trigger.dataset.kpiFilter);
        });

        refs.kpiFilterNotice.addEventListener("click", (event) => {
            if (event.target.closest("[data-clear-kpi-filter]")) {
                clearKpiFilter();
            }
        });

        refs.openNewProposalModal.addEventListener("click", openProposalModal);
        refs.overlayBackdrop.addEventListener("click", closeOverlays);
        refs.proposalPrevButton.addEventListener("click", goToPreviousStep);
        refs.proposalCancelButton.addEventListener("click", closeProposalModal);
        refs.proposalNextButton.addEventListener("click", goToNextStep);
        refs.proposalDraftButton.addEventListener("click", (event) => handleMockSubmit("Rascunho salvo com sucesso.", event.currentTarget, "Salvando..."));
        refs.proposalSubmitButton.addEventListener("click", (event) => handleMockSubmit("Proposta mockada criada com sucesso.", event.currentTarget, "Criando..."));
        refs.openQuickClientFormButton?.addEventListener("click", openQuickClientForm);
        refs.cancelQuickClientFormButton?.addEventListener("click", closeQuickClientForm);
        refs.saveQuickClientButton?.addEventListener("click", saveQuickClient);
        refs.openQuickUnitFormButton?.addEventListener("click", openQuickUnitForm);
        refs.cancelQuickUnitFormButton?.addEventListener("click", closeQuickUnitForm);
        refs.saveQuickUnitButton?.addEventListener("click", saveQuickUnit);
        refs.openQuickMethodFormButton?.addEventListener("click", openQuickMethodForm);
        refs.cancelQuickMethodFormButton?.addEventListener("click", closeQuickMethodForm);
        refs.saveQuickMethodButton?.addEventListener("click", saveQuickMethod);
        refs.openQuickServiceFormButton?.addEventListener("click", openQuickServiceForm);
        refs.cancelQuickServiceFormButton?.addEventListener("click", closeQuickServiceForm);
        refs.saveQuickServiceButton?.addEventListener("click", saveQuickService);
        refs.openQuickItemFormButton?.addEventListener("click", openQuickItemForm);
        refs.cancelQuickItemFormButton?.addEventListener("click", closeQuickItemForm);
        refs.saveQuickItemButton?.addEventListener("click", saveQuickItem);
        refs.openQuickSegmentFormButton?.addEventListener("click", openQuickSegmentForm);
        refs.cancelQuickSegmentFormButton?.addEventListener("click", closeQuickSegmentForm);
        refs.saveQuickSegmentButton?.addEventListener("click", saveQuickSegment);
        refs.proposalCliente?.addEventListener("change", updateQuickUnitClientHint);
        refs.quickActionsList?.addEventListener("click", handleQuickActionClick);

        refs.proposalStepper.querySelectorAll("[data-step-target]").forEach((stepButton) => {
            stepButton.addEventListener("click", () => {
                const targetStep = Number(stepButton.dataset.stepTarget);
                if (targetStep <= state.modalStep) {
                    state.modalStep = targetStep;
                    updateModalStep();
                }
            });
        });

        document.querySelectorAll(".proposal-field input, .proposal-field select").forEach((field) => {
            field.addEventListener("input", () => clearFieldError(field));
            field.addEventListener("change", () => clearFieldError(field));
        });

        document.body.addEventListener("click", handleDelegatedClick);
        document.body.addEventListener("input", handleDelegatedInput);
        document.body.addEventListener("change", handleDelegatedChange);
        document.body.addEventListener("focusin", (event) => {
            const field = event.target;
            if (field.matches("[data-currency-input]")) {
                window.requestAnimationFrame(() => field.select());
            }
        });
        document.body.addEventListener("keydown", handleDelegatedKeydown);

        document.addEventListener("keydown", (event) => {
            if (event.key !== "Escape") {
                return;
            }
            if (refs.newProposalModal.classList.contains("is-open")) {
                closeProposalModal();
                return;
            }
            if (refs.fullFollowupAgendaModal?.classList.contains("is-open")) {
                closeFullFollowupAgenda();
                return;
            }
            if (refs.proposalDrawer.classList.contains("is-open")) {
                closeProposalPanel();
            }
        });
    }

    function handleQuickActionClick(event) {
        const button = event.target.closest("[data-quick-action]");
        if (!button) {
            return;
        }

        const action = button.dataset.quickAction;
        if (action === "summary") {
            window.location.href = "/comercial/resumo-propostas/";
            return;
        }

        if (action === "export") {
            triggerExportExcel(button);
            return;
        }

        if (action === "followups") {
            openFullFollowupAgenda();
            return;
        }

        if (action === "client") {
            openProposalModal();
            state.modalStep = 3;
            updateModalStep();
            openQuickClientForm();
            return;
        }

        if (action === "unit") {
            openProposalModal();
            state.modalStep = 3;
            updateModalStep();
            openQuickUnitForm();
        }
    }

    function triggerExportExcel(button = null) {
        setButtonLoading(button, true, "Preparando...");
        const params = new URLSearchParams();
        if (state.search) params.set("search", state.search);
        if (state.filterNumero) params.set("numero", state.filterNumero);
        if (state.filterStatus) params.set("status", state.filterStatus);
        if (state.filterNatureza) params.set("natureza", state.filterNatureza);
        if (state.filterStatusProposta) params.set("status_proposta", state.filterStatusProposta);
        if (state.filterTipoOperacao) params.set("tipo_operacao", state.filterTipoOperacao);
        if (state.filterResponsavel) params.set("responsavel", state.filterResponsavel);
        if (state.filterCliente) params.set("cliente", state.filterCliente);
        if (state.filterUnidade) params.set("unidade", state.filterUnidade);
        if (state.filterUf) params.set("uf", state.filterUf);
        if (state.filterSegmentoCliente) params.set("segmento_cliente", state.filterSegmentoCliente);
        if (state.filterFonteLead) params.set("fonte_lead", state.filterFonteLead);
        if (state.filterHeatMap) params.set("heat_map", state.filterHeatMap);
        if (state.filterMotivoPerda) params.set("motivo_perda", state.filterMotivoPerda);
        if (state.filterPrazo) params.set("prazo", state.filterPrazo);
        if (state.kpiFilter) params.set("kpi_filter", state.kpiFilter);
        if (state.focusedStage) params.set("focused_stage", state.focusedStage);

        const exportUrl = `/comercial/propostas/exportar-excel/${params.toString() ? `?${params.toString()}` : ""}`;
        window.location.href = exportUrl;

        window.setTimeout(() => {
            setButtonLoading(button, false);
        }, 1400);
    }

    function handleDelegatedClick(event) {
        const addProposalServiceTrigger = event.target.closest("#addProposalServiceRow");
        if (addProposalServiceTrigger) {
            event.preventDefault();
            addProposalServiceRow();
            return;
        }

        const removeProposalServiceTrigger = event.target.closest("[data-proposal-service-remove]");
        if (removeProposalServiceTrigger) {
            event.preventDefault();
            removeProposalServiceRow(Number(removeProposalServiceTrigger.dataset.proposalServiceRemove));
            return;
        }

        const seeAllTrigger = event.target.closest("[data-see-all-stage]");
        if (seeAllTrigger) {
            openFocusedStageView(seeAllTrigger.dataset.seeAllStage);
            return;
        }

        const backToAllTrigger = event.target.closest("[data-back-all-stages]");
        if (backToAllTrigger) {
            if (state.kpiFilter) {
                clearKpiFilter();
            } else {
                state.focusedStage = "";
                state.focusedPage = 1;
                renderPipeline();
            }
            return;
        }

        const focusedPageTrigger = event.target.closest("[data-focused-page]");
        if (focusedPageTrigger) {
            const nextPage = Number(focusedPageTrigger.dataset.focusedPage);
            if (nextPage) {
                goToFilteredPage(nextPage);
            }
            return;
        }

        const proposalPdfTrigger = event.target.closest("[data-proposal-pdf]");
        if (proposalPdfTrigger) {
            event.preventDefault();
            event.stopImmediatePropagation();
            handleProposalPdfRequest(proposalPdfTrigger);
            return;
        }

        const proposalPdfMenuTrigger = event.target.closest("[data-proposal-pdf-menu]");
        if (proposalPdfMenuTrigger) {
            event.preventDefault();
            const menu = proposalPdfMenuTrigger.closest(".proposal-card__pdf-menu");
            const isOpen = menu?.classList.toggle("is-open");
            proposalPdfMenuTrigger.setAttribute("aria-expanded", String(Boolean(isOpen)));
            return;
        }

        const proposalTrigger = event.target.closest("[data-proposal-id]");
        if (proposalTrigger && !event.target.closest("[data-panel-action], [data-proposal-pdf], [data-proposal-pdf-menu]")) {
            openProposalPanel(Number(proposalTrigger.dataset.proposalId));
            return;
        }

        const agendaAction = event.target.closest("[data-agenda-action]");
        if (agendaAction) {
            const action = agendaAction.dataset.agendaAction;
            if (action === "close") {
                closeFullFollowupAgenda();
            } else if (action === "apply-filters") {
                applyFollowupAgendaFilters();
            } else if (action === "clear-filters") {
                clearFollowupAgendaFilters();
            } else if (action === "new-followup") {
                showNotification({
                    type: "info",
                    title: "Registrar acompanhamento",
                    message: "Formulário de acompanhamento acionado."
                });
            } else if (action === "prev-page") {
                state.agendaPage = Math.max(1, state.agendaPage - 1);
                renderFollowupAgenda();
            } else if (action === "next-page") {
                state.agendaPage = Math.min(getAgendaTotalPages(), state.agendaPage + 1);
                renderFollowupAgenda();
            } else if (action === "go-page") {
                state.agendaPage = Number(agendaAction.dataset.page) || 1;
                renderFollowupAgenda();
            } else if (action === "select-day") {
                selectAgendaDay(agendaAction.dataset.date);
            } else if (action === "view-day") {
                state.agendaDayFocus = state.agendaSelectedDate;
                state.agendaPage = 1;
                renderFollowupAgenda();
            } else if (action === "previous-month" || action === "next-month") {
                showToast("Calendário mensal mockado fixado em Julho de 2026 nesta versão.");
            }
            return;
        }

        const closeTrigger = event.target.closest("[data-close-modal]");
        if (closeTrigger) {
            closeModal(document.getElementById(closeTrigger.dataset.closeModal));
            return;
        }

        const tabTrigger = event.target.closest("[data-panel-tab]");
        if (tabTrigger) {
            state.activeDetailTab = tabTrigger.dataset.panelTab;
            renderProposalPanel();
            return;
        }

        const actionTrigger = event.target.closest("[data-panel-action]");
        if (!actionTrigger) {
            if (event.target.closest("[data-retry-pipeline]")) {
                retryLoadPipeline();
                return;
            }

            if (event.target.closest("[data-reset-pipeline-error]")) {
                hidePipelineErrorState();
                return;
            }

            if (event.target.closest("[data-clear-commercial-filters]")) {
                clearComercialFilters();
                return;
            }

            if (event.target.closest("[data-focus-commercial-search]")) {
                focusComercialSearch();
                return;
            }

            if (event.target.closest("[data-proposal-item-add]")) {
                addProposalItemRow();
                return;
            }

            if (event.target.closest("[data-retry-followups]")) {
                retryLoadFollowups();
                return;
            }

            if (event.target.closest("[data-recover-connection]")) {
                recoverConnectionState();
                return;
            }

            if (event.target.closest("[data-back-home]")) {
                window.location.href = "/";
                return;
            }

            if (event.target.closest("[data-proposal-error-review]")) {
                focusFirstProposalErrorField();
                return;
            }

            if (event.target.closest("[data-proposal-error-close]")) {
                closeProposalModal();
                return;
            }

            const stageFilterTrigger = event.target.closest("[data-stage-filter-toggle]");
            if (stageFilterTrigger) {
                state.filtersOpen = !state.filtersOpen;
                refs.filtersPanel.classList.toggle("is-hidden", !state.filtersOpen);
                return;
            }

            return;
        }

        if (actionTrigger.dataset.panelAction === "upload-documents") {
            refs.proposalDrawer.querySelector("[data-proposal-attachments-input]")?.click();
            return;
        }
        if (actionTrigger.dataset.panelAction === "delete-document") {
            deleteProposalDocument(actionTrigger.dataset.documentUrl, actionTrigger.dataset.documentId);
            return;
        }

        const action = actionTrigger.dataset.panelAction;
        if (action === "close-panel") {
            closeProposalPanel();
        } else if (action === "edit-data") {
            state.activeDetailTab = "dados";
            state.dataEditMode = true;
            state.saveProposalError = false;
            renderProposalPanel();
        } else if (action === "cancel-data") {
            state.saveProposalError = false;
            state.dataEditMode = false;
            renderProposalPanel();
        } else if (action === "save-data") {
            saveCommercialData();
        } else if (action === "edit-critical-analysis") {
            state.activeDetailTab = "analise-critica";
            state.dataEditMode = false;
            state.criticalAnalysisEditMode = true;
            state.saveProposalError = false;
            renderProposalPanel();
        } else if (action === "cancel-critical-analysis") {
            state.criticalAnalysisEditMode = false;
            state.saveProposalError = false;
            renderProposalPanel();
        } else if (action === "save-critical-analysis") {
            saveCriticalAnalysis();
        } else if (action === "edit-scope") {
            state.activeDetailTab = "escopo";
            state.scopeEditMode = true;
            state.saveProposalError = false;
            syncScopeDraftServicesFromProposal(getSelectedProposal());
            renderProposalPanel();
        } else if (action === "cancel-scope") {
            state.saveProposalError = false;
            state.scopeEditMode = false;
            state.scopeDraftServices = [];
            renderProposalPanel();
        } else if (action === "save-scope") {
            saveScopeData();
        } else if (action === "add-scope-service") {
            addScopeDraftService();
        } else if (action === "remove-scope-service") {
            removeScopeDraftService(Number(actionTrigger.dataset.scopeServiceIndex));
        } else if (action === "open-followup") {
            state.activeDetailTab = "followups";
            state.followupFormOpen = true;
            renderProposalPanel();
        } else if (action === "cancel-followup") {
            state.followupFormOpen = false;
            renderProposalPanel();
        } else if (action === "save-followup") {
            saveFollowup();
        } else if (action === "upload-documents") {
            refs.proposalDrawer.querySelector("[data-proposal-attachments-input]")?.click();
        } else if (action === "delete-document") {
            deleteProposalDocument(actionTrigger.dataset.documentUrl, actionTrigger.dataset.documentId);
        } else if (action === "new-rev") {
            createNewRevision();
        } else if (action === "generate-pdf") {
            generateProposalPdf();
        } else if (action === "focus-status") {
            state.activeDetailTab = "resumo";
            state.focusStatusSection = true;
            renderProposalPanel();
        } else if (action === "save-status") {
            saveStatusChange();
        } else if (action === "view-history") {
            state.activeDetailTab = "historico";
            renderProposalPanel();
        } else if (action === "view-followups") {
            state.activeDetailTab = "followups";
            renderProposalPanel();
        } else if (action === "edit-note") {
            state.noteEditMode = true;
            renderProposalPanel();
        } else if (action === "cancel-note") {
            state.noteEditMode = false;
            renderProposalPanel();
        } else if (action === "save-note") {
            saveQuickNote();
        } else if (action === "show-scope-toast") {
            showNotification({
                type: "info",
                title: "Escopo exibido",
                message: "Escopo completo exibido apenas como interação mockada."
            });
        } else if (action === "retry-save-error") {
            retrySaveProposalChanges();
        } else if (action === "dismiss-save-error") {
            state.saveProposalError = false;
            renderProposalPanel();
        }
    }

    function handleDelegatedChange(event) {
        const field = event.target;
        if (field.matches("[data-proposal-attachments-input]")) {
            uploadProposalDocuments(Array.from(field.files || []));
            return;
        }
        if (field.matches("[data-critical-analysis-field]")) {
            state.criticalAnalysisAnswers[field.dataset.criticalAnalysisField] = field.value;
            renderCriticalAnalysisControls();
            return;
        }
        if (field.closest(".proposal-field")) {
            clearProposalFieldError(field.id);
        }

        if (field.matches("[data-proposal-service-index]")) {
            updateProposalServiceRow(Number(field.dataset.proposalServiceIndex), field.value);
            return;
        }

        if (field.id === "panelStatusSelect" || field.id === "panelReasonSelect") {
            state.statusError = false;
            updateStatusReasonState();
        }

        if (field.matches("[data-agenda-select='responsavel']")) {
            state.agendaResponsavel = field.value;
        }

        if (field.matches("[data-agenda-select='status']")) {
            state.agendaStatus = field.value;
        }

        if (field.matches("[data-agenda-select='per-page']")) {
            state.agendaPerPage = Number(field.value) || 10;
            state.agendaPage = 1;
            renderFollowupAgenda();
        }

        if (field.matches("[data-focused-page-size]")) {
            changeFilteredItemsPerPage(Number(field.value) || 6);
        }

        if (field.matches("[data-scope-service-index]")) {
            updateScopeDraftService(Number(field.dataset.scopeServiceIndex), field.value);
        }

        if (field.matches("[data-scope-item-field]")) {
            updateScopeDraftItem(
                Number(field.dataset.scopeItemIndex),
                field.dataset.scopeItemField,
                field.value
            );
            if (field.dataset.scopeItemField === "unitPrice") {
                field.value = formatCurrencyInputValue(parseCurrencyValue(field.value));
            }
            if (field.dataset.scopeItemField === "quantity") {
                field.value = String(Math.max(1, Number(field.value) || 1));
            }
        }

        if (field.matches("[data-proposal-item-field='item']")) {
            updateProposalItem(Number(field.dataset.itemId), "item", field.value);
        }

        if (field.matches("[data-proposal-item-field='unitPrice']")) {
            updateProposalItem(Number(field.dataset.itemId), "unitPrice", field.value);
        }

        if (field.matches("[data-proposal-item-field='quantity']")) {
            updateProposalItem(Number(field.dataset.itemId), "quantity", field.value);
            field.value = String(Math.max(1, Number(field.value) || 1));
        }

        if (field.id === "proposalReceita") {
            field.value = field.value ? formatCurrencyDisplay(parseCurrencyValue(field.value)) : "";
        }
    }

    function handleDelegatedInput(event) {
        const field = event.target;
        if (field.matches("[data-stage-search]")) {
            state.search = field.value.trim().toLowerCase();
            state.focusedPage = 1;
            renderPipeline();
        }

        if (field.closest(".proposal-field")) {
            clearProposalFieldError(field.id);
        }

        if (field.matches("[data-currency-input]")) {
            field.value = formatCurrencyTyping(field.value, field.dataset.currencyInput === "with-symbol");
        }

        if (field.matches("[data-proposal-item-field='unitPrice']")) {
            updateProposalItem(Number(field.dataset.itemId), "unitPrice", field.value);
        }

        if (field.matches("[data-scope-item-field='unitPrice']")) {
            updateScopeDraftItem(Number(field.dataset.scopeItemIndex), "unitPrice", field.value);
        }

        if (field.matches("[data-scope-item-field='quantity']")) {
            updateScopeDraftItem(Number(field.dataset.scopeItemIndex), "quantity", field.value);
        }

        if (field.matches("[data-proposal-item-field='quantity']")) {
            updateProposalItem(Number(field.dataset.itemId), "quantity", field.value);
        }

        if (field.matches("[data-agenda-input='search']")) {
            state.agendaSearch = field.value.trim().toLowerCase();
        }

        if (field.matches("[data-agenda-input='period']")) {
            state.agendaPeriod = field.value.trim();
        }
    }

    function handleDelegatedKeydown(event) {
        const proposalPdfTrigger = event.target.closest("[data-proposal-pdf]");
        if (proposalPdfTrigger) {
            event.preventDefault();
            handleProposalPdfRequest(proposalPdfTrigger);
            return;
        }

        const proposalTrigger = event.target.closest("[data-proposal-id]");
        if (proposalTrigger && !event.target.closest("[data-proposal-pdf]") && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            openProposalPanel(Number(proposalTrigger.dataset.proposalId));
        }
    }

    function renderAll() {
        refs.contentGrid?.classList.toggle("is-connection-error", state.connectionError);
        refs.sidebarStack?.classList.toggle("is-hidden", state.connectionError);
        renderKpis();
        renderKpiFilterNotice();
        renderPipeline();
        renderRevenueBars();
        if (state.selectedProposalId !== null && refs.proposalDrawer.classList.contains("is-open")) {
            renderProposalPanel();
        }
    }

    function renderKpis() {
        refs.kpiStrip.innerHTML = kpis.map((kpi) => {
            const meta = getKpiCardMeta(kpi);
            const isInteractive = Boolean(meta?.filterType);
            return `
            <article class="kpi-card ${kpi.attention ? "is-attention" : ""} ${isInteractive ? "is-interactive" : ""} ${state.kpiFilter === meta?.filterType ? "is-active" : ""}" ${isInteractive ? `data-kpi-filter="${meta.filterType}" role="button" tabindex="0" aria-pressed="${state.kpiFilter === meta.filterType ? "true" : "false"}` : ""}>
                <span class="kpi-icon ${kpi.attention ? "is-attention" : ""}">
                    <span class="material-icons" aria-hidden="true">${kpi.icon}</span>
                </span>
                <div class="kpi-content">
                    <span class="kpi-title">${kpi.title}</span>
                    <strong class="kpi-value">${kpi.value}</strong>
                </div>
            </article>
        `;
        }).join("");
    }

    function renderPipeline() {
        if (state.connectionError) {
            refs.pipelineBoard.classList.add("is-focused-view");
            refs.pipelineBoard.innerHTML = renderConnectionUnavailableState();
            bindPipelineBoardInteractions();
            return;
        }

        if (state.pipelineError) {
            refs.pipelineBoard.classList.add("is-focused-view");
            refs.pipelineBoard.innerHTML = renderPipelineErrorState();
            bindPipelineBoardInteractions();
            return;
        }

        if (shouldShowInitialEmptyState()) {
            showInitialEmptyState();
            return;
        }

        const visibleProposals = getVisibleProposals();
        if (!visibleProposals.length) {
            showFilteredEmptyState();
            return;
        }

        if (state.kpiFilter) {
            refs.pipelineBoard.classList.add("is-focused-view");
            refs.pipelineBoard.innerHTML = renderKpiFocusedView();
            bindPipelineBoardInteractions();
            return;
        }

        if (state.focusedStage) {
            refs.pipelineBoard.classList.add("is-focused-view");
            refs.pipelineBoard.innerHTML = renderFocusedStageView(state.focusedStage);
            bindPipelineBoardInteractions();
            return;
        }

        hideEmptyStates();
        refs.pipelineBoard.innerHTML = COLUMN_DEFINITIONS.map((column) => {
            const proposalsByColumn = getFilteredProposalsByColumn(column.key);
            return `
                <section class="pipeline-column">
                    <header class="pipeline-column__header pipeline-column__header--${column.tone}">
                        <div class="pipeline-column__heading">
                            <span class="pipeline-column__step">${COLUMN_DEFINITIONS.indexOf(column) + 1}</span>
                            <div>
                                <h3>${column.label}</h3>
                                <p>${column.description}</p>
                            </div>
                        </div>
                        <span class="pipeline-count">${proposalsByColumn.length}</span>
                    </header>
                    ${proposalsByColumn.map(renderProposalCard).join("")}
                    <button class="pipeline-add-button" data-add-proposal-stage="${escapeHtml(column.key)}" type="button">
                        <span class="material-icons" aria-hidden="true">add</span>
                        Adicionar proposta
                    </button>
                    ${proposalsByColumn.length ? `<button class="see-all-button" data-see-all-stage="${column.key}" type="button">Ver todas (${proposalsByColumn.length})</button>` : ""}
                </section>
            `;
        }).join("");
        bindPipelineBoardInteractions();
    }

    function bindPipelineBoardInteractions() {
        refs.pipelineBoard?.querySelectorAll("[data-see-all-stage]").forEach((button) => {
            button.onclick = (event) => {
                event.preventDefault();
                event.stopPropagation();
                openFocusedStageView(button.dataset.seeAllStage);
            };
        });

        refs.pipelineBoard?.querySelectorAll("[data-add-proposal-stage]").forEach((button) => {
            button.onclick = (event) => {
                event.preventDefault();
                event.stopPropagation();
                openProposalModal();
            };
        });

        refs.pipelineBoard?.querySelectorAll("[data-back-all-stages]").forEach((button) => {
            button.onclick = (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (state.kpiFilter) {
                    clearKpiFilter();
                } else {
                    state.focusedStage = "";
                    state.focusedPage = 1;
                    renderPipeline();
                }
            };
        });

        refs.pipelineBoard?.querySelectorAll("[data-focused-page]").forEach((button) => {
            button.onclick = (event) => {
                event.preventDefault();
                event.stopPropagation();
                const nextPage = Number(button.dataset.focusedPage);
                if (nextPage) {
                    goToFilteredPage(nextPage);
                }
            };
        });
    }

    function renderFocusedStageView(stageKey) {
        const stageMeta = getStageMeta(stageKey);
        const proposalsByStage = getFilteredProposalsByColumn(stageKey);

        return renderFocusedCollectionView({
            title: stageMeta.label,
            proposalsList: proposalsByStage,
            footerText: `Mostrando ${proposalsByStage.length} propostas`
        });
    }

    function renderKpiFocusedView() {
        const config = getKpiFilterConfig(state.kpiFilter);
        const proposalsList = getKpiFilteredProposals(state.kpiFilter);
        return renderFocusedCollectionView({
            title: config.noticeValue,
            proposalsList,
            footerText: config.footerText ? config.footerText(proposalsList.length) : `Mostrando ${proposalsList.length} propostas`
        }).replace("VisualizaÃ§Ã£o completa da etapa", config.focusedSubtitle);
    }

    function renderFocusedCollectionView({ title, proposalsList, footerText }) {
        const pagination = getFocusedPaginationData(proposalsList);
        return `
            <section class="focused-stage">
                <button class="focused-stage__back" data-back-all-stages type="button">
                    <span class="material-icons" aria-hidden="true">arrow_back</span>
                    Voltar para todas as etapas
                </button>

                <div class="focused-stage__header">
                    <div class="focused-stage__title-wrap">
                        <div class="focused-stage__copy">
                            <div class="focused-stage__title-row">
                                <h2>${title}</h2>
                                <span class="focused-stage__count">${proposalsList.length} propostas</span>
                            </div>
                        </div>
                    </div>

                    <div class="focused-stage__actions">
                        <label class="focused-stage__search">
                            <span class="material-icons" aria-hidden="true">search</span>
                            <input data-stage-search type="search" value="${escapeHtml(state.search)}" placeholder="Buscar propostas...">
                        </label>
                    </div>
                </div>

                <div class="focused-stage__grid">
                    ${pagination.items.map(renderProposalCard).join("")}
                </div>

                ${renderFocusedPagination(pagination, footerText)}
            </section>
        `;
    }

    function openFocusedStageView(stageKey) {
        if (!stageKey) {
            return;
        }

        state.kpiFilter = "";
        state.focusedStage = stageKey;
        state.focusedPage = 1;
        renderKpis();
        renderKpiFilterNotice();
        renderPipeline();
    }

    function getFocusedPaginationData(proposalsList) {
        const totalItems = proposalsList.length;
        const itemsPerPage = state.focusedItemsPerPage || 6;
        const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
        const currentPage = Math.min(state.focusedPage || 1, totalPages);
        const startIndex = totalItems ? (currentPage - 1) * itemsPerPage : 0;
        const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

        state.focusedPage = currentPage;

        return {
            items: proposalsList.slice(startIndex, endIndex),
            totalItems,
            itemsPerPage,
            currentPage,
            totalPages,
            start: totalItems ? startIndex + 1 : 0,
            end: totalItems ? endIndex : 0
        };
    }

    function renderFocusedPagination({ totalItems, itemsPerPage, currentPage, totalPages, start, end }, fallbackText) {
        const infoText = totalItems
            ? `Mostrando ${start}–${end} de ${totalItems} propostas`
            : (fallbackText || "Nenhuma proposta encontrada");

        const pageButtons = totalPages > 1
            ? Array.from({ length: totalPages }, (_, index) => {
                const page = index + 1;
                return `
                    <button class="focused-pagination__page ${page === currentPage ? "is-active" : ""}" data-focused-page="${page}" type="button" aria-label="Ir para página ${page}" ${page === currentPage ? 'aria-current="page"' : ""}>
                        ${page}
                    </button>
                `;
            }).join("")
            : "";

        return `
            <div class="focused-stage__footer focused-pagination">
                <div class="focused-pagination__info">
                    <span class="focused-stage__footer-icon material-icons" aria-hidden="true">info</span>
                    <span>${infoText}</span>
                </div>

                <div class="focused-pagination__controls">
                    <label class="focused-pagination__size">
                        <span>Itens por página</span>
                        <select data-focused-page-size>
                            ${[6, 9, 12].map((size) => `<option value="${size}" ${size === itemsPerPage ? "selected" : ""}>${size}</option>`).join("")}
                        </select>
                    </label>

                    ${totalPages > 1 ? `
                        <div class="focused-pagination__nav">
                            <button class="focused-pagination__page" data-focused-page="${Math.max(1, currentPage - 1)}" type="button" aria-label="Página anterior" ${currentPage === 1 ? "disabled" : ""}>
                                <span class="material-icons" aria-hidden="true">chevron_left</span>
                            </button>
                            ${pageButtons}
                            <button class="focused-pagination__page" data-focused-page="${Math.min(totalPages, currentPage + 1)}" type="button" aria-label="Próxima página" ${currentPage === totalPages ? "disabled" : ""}>
                                <span class="material-icons" aria-hidden="true">chevron_right</span>
                            </button>
                        </div>
                    ` : ""}
                </div>
            </div>
        `;
    }

    function goToFilteredPage(page) {
        state.focusedPage = Math.max(1, page || 1);
        renderPipeline();
    }

    function changeFilteredItemsPerPage(value) {
        state.focusedItemsPerPage = value;
        state.focusedPage = 1;
        renderPipeline();
    }

    function renderPipelineErrorState() {
        return `
            <section class="commercial-error-state commercial-error-state--pipeline">
                <div class="commercial-error-card">
                    <span class="commercial-error-card__icon material-icons" aria-hidden="true">warning</span>
                    <h3>Não foi possível carregar as propostas</h3>
                    <p>Houve um problema ao buscar os dados do pipeline comercial.</p>
                    <div class="commercial-error-card__actions">
                        <button class="panel-button panel-button--primary" data-retry-pipeline type="button">Tentar novamente</button>
                        <button class="panel-button panel-button--soft" data-reset-pipeline-error type="button">Voltar</button>
                    </div>
                </div>
            </section>
        `;
    }

    function renderInitialEmptyState() {
        return `
            <section class="commercial-empty-shell">
                <div class="commercial-empty-state commercial-empty-state--initial">
                    <div class="commercial-empty-icon" aria-hidden="true">
                        <span class="material-icons">note_add</span>
                    </div>
                    <h3>Nenhuma proposta cadastrada ainda</h3>
                    <p>Comece criando a primeira proposta comercial para alimentar o pipeline.</p>
                    <button class="btn-commercial btn-commercial-primary commercial-empty-state__button" data-open-first-proposal type="button">
                        <span class="material-icons" aria-hidden="true">add_circle</span>
                        Criar primeira proposta
                    </button>
                </div>
            </section>
        `;
    }

    function renderEmptyFilterState() {
        return `
            <section class="commercial-empty-shell">
                <div class="commercial-empty-state commercial-empty-state--filtered">
                    <div class="commercial-empty-icon" aria-hidden="true">
                        <span class="material-icons">search_off</span>
                    </div>
                    <h3>Nenhuma proposta encontrada</h3>
                    <p>Nenhum item corresponde aos filtros ou à busca aplicada.</p>
                    <div class="commercial-empty-actions">
                        <button class="btn-commercial btn-commercial-primary" data-clear-commercial-filters type="button">Limpar filtros</button>
                        <button class="btn-commercial btn-commercial-secondary" data-focus-commercial-search type="button">Ajustar busca</button>
                    </div>
                </div>
            </section>
        `;
    }

    function renderConnectionUnavailableState() {
        return `
            <section class="commercial-error-state commercial-error-state--connection">
                <div class="commercial-connection-card">
                    <span class="commercial-connection-card__icon material-icons" aria-hidden="true">cloud_off</span>
                    <h3>Conexão indisponível</h3>
                    <p>O módulo Comercial está temporariamente indisponível. Tente novamente em instantes.</p>
                    <div class="commercial-error-card__actions">
                        <button class="panel-button panel-button--primary" data-recover-connection type="button">Atualizar página</button>
                        <button class="panel-button panel-button--soft" data-back-home type="button">Voltar para o início</button>
                    </div>
                    <span class="commercial-connection-card__code">Código do erro: COM-503</span>
                </div>
            </section>
        `;
    }

    function renderProposalCard(proposal) {
        const statusTone = getStatusTone(proposal.statusProposta);
        const pdfEndpoint = buildEndpoint(state.endpoints.pdfPattern, proposal.id);
        const criticalAnalysisPdfEndpoint = buildEndpoint(state.endpoints.criticalAnalysisPdfPattern, proposal.id);

        return `
            <article class="proposal-card" data-proposal-id="${proposal.id}" role="button" tabindex="0" aria-label="Abrir detalhes de ${escapeHtml(proposal.numeroProposta)}">
                <div class="proposal-card__top">
                    <p class="proposal-number">${escapeHtml(proposal.numeroProposta)}</p>
                    <span class="proposal-badge proposal-badge--revision">REV ${escapeHtml(proposal.rev)}</span>
                </div>
                <p class="proposal-client">${escapeHtml(proposal.empresa)}</p>
                <span class="proposal-badge proposal-badge--status is-${statusTone}">${escapeHtml(proposal.statusProposta || "Status não informado")}</span>
                <p class="proposal-nature">${escapeHtml(proposal.tipoOperacao || proposal.natureza)}</p>
                <div class="proposal-meta-row">
                    <span class="proposal-meta">
                        <span class="material-icons" aria-hidden="true">calendar_today</span>
                        ${escapeHtml(proposal.dataEntregaProposta)}
                    </span>
                    <span class="proposal-meta">
                        <span class="material-icons" aria-hidden="true">person_outline</span>
                        ${escapeHtml(proposal.responsavel)}
                    </span>
                </div>
                <div class="proposal-footer">
                    ${pdfEndpoint ? `
                        <div class="proposal-card__pdf-menu">
                            <button class="proposal-card__pdf" data-proposal-pdf-menu type="button" aria-expanded="false">
                                <span class="material-icons" aria-hidden="true">picture_as_pdf</span>
                                PDFs
                                <span class="material-icons proposal-card__pdf-chevron" aria-hidden="true">expand_more</span>
                            </button>
                            <div class="proposal-card__pdf-options" role="menu">
                                <a data-proposal-pdf data-pdf-label="Proposta" href="${escapeHtml(pdfEndpoint)}" download="proposta_${escapeHtml(proposal.numeroProposta || proposal.id)}.pdf" role="menuitem">PDF da proposta</a>
                                ${criticalAnalysisPdfEndpoint ? `<a data-proposal-pdf data-pdf-label="Análise crítica" href="${escapeHtml(criticalAnalysisPdfEndpoint)}" download="analise_critica_proposta_${escapeHtml(proposal.numeroProposta || proposal.id)}.pdf" role="menuitem">PDF da análise crítica</a>` : ""}
                            </div>
                        </div>
                    ` : ""}
                    <strong class="proposal-value">${escapeHtml(proposal.estimativaReceita)}</strong>
                </div>
            </article>
        `;
    }

    function renderFollowups() {
        if (state.followupsError) {
            refs.followupList.innerHTML = `
                <div class="sidebar-error-state">
                    <span class="sidebar-error-state__icon material-icons" aria-hidden="true">warning</span>
                    <h3>Erro ao carregar acompanhamentos</h3>
                    <p>Não foi possível sincronizar a agenda comercial neste momento.</p>
                    <button class="panel-button panel-button--soft" data-retry-followups type="button">Tentar novamente</button>
                    <small>Última atualização: há 5 min</small>
                </div>
            `;
            refs.viewAgendaButton.disabled = true;
            return;
        }

        const sidebarFollowups = proposals
            .flatMap((proposal) => proposal.followUps.map((item) => ({
                proposal,
                item
            })))
            .filter((entry) => entry.item.dataProximaAcao)
            .sort((a, b) => compareDates(a.item.dataProximaAcao, b.item.dataProximaAcao))
            .slice(0, 3);

        if (!sidebarFollowups.length) {
            refs.followupList.innerHTML = `
                <div class="sidebar-empty-state">
                    <span class="material-icons" aria-hidden="true">event_busy</span>
                    <p>Nenhum acompanhamento pendente no momento.</p>
                </div>
            `;
            refs.viewAgendaButton.disabled = true;
            return;
        }

        refs.followupList.innerHTML = sidebarFollowups.map(({ proposal, item }) => {
            const [day, month] = formatAgendaDate(item.dataProximaAcao);
            return `
                <article class="followup-item">
                    <div class="followup-date">
                        <strong>${day}</strong>
                        <span>${month}</span>
                    </div>
                    <div class="followup-content">
                        <strong>${escapeHtml(proposal.numeroProposta)}</strong>
                        <strong>${escapeHtml(proposal.empresa)}</strong>
                        <p>${escapeHtml(item.proximaAcao || item.comentario)}</p>
                        <p>${escapeHtml(item.responsavel)}</p>
                    </div>
                    <div class="followup-time">
                        <span>${escapeHtml(item.hora || "--:--")}</span>
                        <span class="material-icons" aria-hidden="true">call</span>
                    </div>
                </article>
            `;
        }).join("");
        refs.viewAgendaButton.disabled = false;
    }

    function showPipelineErrorState() {
        state.connectionError = false;
        state.pipelineError = true;
        renderAll();
    }

    function hidePipelineErrorState() {
        state.pipelineError = false;
        renderAll();
    }

    function retryLoadPipeline() {
        showComercialLoading();
        window.setTimeout(() => {
            state.pipelineError = false;
            hideComercialLoading();
            renderAll();
            showNotification({
                type: "success",
                title: "Dados carregados",
                message: "As informações foram atualizadas com sucesso."
            });
        }, 700);
    }

    function showEmptyFilterState() {
        state.connectionError = false;
        state.pipelineError = false;
        state.search = "sem resultado mock";
        state.filterCliente = "zzzz";
        state.focusedStage = "Em Análise";
        state.kpiFilter = "";
        state.focusedPage = 1;
        renderAll();
    }

    function getCommercialAppElement() {
        return document.getElementById("commercialApp");
    }

    function getTotalProposalsCount() {
        const fromDataset = Number(getCommercialAppElement()?.dataset.totalPropostas || 0);
        return Number.isFinite(fromDataset) ? fromDataset : proposals.length;
    }

    function hasActiveCommercialFilters() {
        return Boolean(
            state.search
            || state.filterNumero
            || state.filterStatus
            || state.filterNatureza
            || state.filterStatusProposta
            || state.filterTipoOperacao
            || state.filterResponsavel
            || state.filterCliente
            || state.filterUnidade
            || state.filterUf
            || state.filterSegmentoCliente
            || state.filterFonteLead
            || state.filterHeatMap
            || state.filterMotivoPerda
            || state.filterPrazo
        );
    }

    function shouldShowInitialEmptyState() {
        return getTotalProposalsCount() === 0;
    }

    function showInitialEmptyState() {
        refs.pipelineBoard.classList.add("is-focused-view");
        refs.pipelineBoard.innerHTML = renderInitialEmptyState();
        bindPipelineBoardInteractions();
    }

    function showFilteredEmptyState() {
        refs.pipelineBoard.classList.add("is-focused-view");
        refs.pipelineBoard.innerHTML = renderEmptyFilterState();
        bindPipelineBoardInteractions();
    }

    function hideEmptyStates() {
        refs.pipelineBoard.classList.remove("is-focused-view");
    }

    function clearComercialFilters() {
        state.search = "";
        state.filterNumero = "";
        state.filterStatus = "";
        state.filterNatureza = "";
        state.filterStatusProposta = "";
        state.filterTipoOperacao = "";
        state.filterResponsavel = "";
        state.filterCliente = "";
        state.filterUnidade = "";
        state.filterUf = "";
        state.filterSegmentoCliente = "";
        state.filterFonteLead = "";
        state.filterHeatMap = "";
        state.filterMotivoPerda = "";
        state.filterPrazo = "";
        state.focusedPage = 1;
        if (refs.globalSearchInput) refs.globalSearchInput.value = "";
        if (refs.filterNumero) refs.filterNumero.value = "";
        if (refs.filterStatus) refs.filterStatus.value = "";
        if (refs.filterNatureza) refs.filterNatureza.value = "";
        if (refs.filterStatusProposta) refs.filterStatusProposta.value = "";
        if (refs.filterTipoOperacao) refs.filterTipoOperacao.value = "";
        if (refs.filterResponsavel) refs.filterResponsavel.value = "";
        if (refs.filterCliente) refs.filterCliente.value = "";
        if (refs.filterUnidade) refs.filterUnidade.value = "";
        if (refs.filterUf) refs.filterUf.value = "";
        if (refs.filterSegmentoCliente) refs.filterSegmentoCliente.value = "";
        if (refs.filterFonteLead) refs.filterFonteLead.value = "";
        if (refs.filterHeatMap) refs.filterHeatMap.value = "";
        if (refs.filterMotivoPerda) refs.filterMotivoPerda.value = "";
        if (refs.filterPrazo) refs.filterPrazo.value = "";
        renderAll();
    }

    function focusComercialSearch() {
        const target = refs.pipelineBoard.querySelector("[data-stage-search]") || refs.globalSearchInput;
        target?.focus();
    }

    function showFollowupsErrorState() {
        state.followupsError = true;
        renderFollowups();
    }

    function retryLoadFollowups() {
        window.setTimeout(() => {
            state.followupsError = false;
            renderFollowups();
            showNotification({
                type: "success",
                title: "Dados carregados",
                message: "As informações foram atualizadas com sucesso."
            });
        }, 320);
    }

    function showConnectionUnavailableState() {
        state.connectionError = true;
        state.pipelineError = false;
        renderAll();
    }

    function recoverConnectionState() {
        showComercialLoading();
        window.setTimeout(() => {
            state.connectionError = false;
            hideComercialLoading();
            renderAll();
            showNotification({
                type: "success",
                title: "Dados carregados",
                message: "As informações foram atualizadas com sucesso."
            });
        }, 750);
    }

    function openFullFollowupAgenda() {
        state.agendaPage = 1;
        renderFollowupAgenda();
        refs.fullFollowupAgendaModal.classList.add("is-open");
        refs.fullFollowupAgendaModal.setAttribute("aria-hidden", "false");
        refs.overlayBackdrop.classList.add("is-visible");
        document.body.classList.add("comercial-no-scroll");
    }

    function closeFullFollowupAgenda() {
        refs.fullFollowupAgendaModal.classList.remove("is-open");
        refs.fullFollowupAgendaModal.setAttribute("aria-hidden", "true");
        syncOverlayState();
    }

    function renderFollowupAgenda() {
        const summaryItems = getAgendaFilteredItems({ includeDayFocus: false });
        const pagedItems = getAgendaPagedItems();
        const groups = groupAgendaItemsByDate(pagedItems.items);
        const selectedDayItems = getAgendaDayItems(state.agendaSelectedDate, summaryItems);
        const calendarMarkup = renderAgendaCalendar(summaryItems);
        const summary = getAgendaSummary(summaryItems);
        const totalFiltered = pagedItems.total;
        const totalPages = pagedItems.totalPages;
        const rangeLabel = formatAgendaPeriodLabel(state.agendaPeriod);

        refs.fullFollowupAgendaModal.innerHTML = `
            <div class="agenda-modal__card">
                <div class="agenda-modal__header">
                    <div class="agenda-modal__title-wrap">
                        <span class="agenda-modal__title-icon">
                            <span class="material-icons" aria-hidden="true">calendar_month</span>
                        </span>
                        <div>
                            <h2 id="agendaModalTitle">Agenda Completa de Follow-ups</h2>
                            <p>Visualize, filtre e acompanhe todos os próximos contatos comerciais.</p>
                        </div>
                    </div>
                    <button class="agenda-modal__close" data-agenda-action="close" type="button" aria-label="Fechar">
                        <span class="material-icons" aria-hidden="true">close</span>
                        Fechar
                    </button>
                </div>

                <div class="agenda-modal__body">
                    <section class="agenda-summary-cards">
                        ${renderAgendaSummaryCard("today", "Hoje", `${summary.today}`, "follow-ups")}
                        ${renderAgendaSummaryCard("date_range", "Esta semana", `${summary.week}`, "follow-ups")}
                        ${renderAgendaSummaryCard("schedule", "Pendentes", `${summary.pending}`, "no total")}
                        <article class="agenda-summary-card">
                            <span class="agenda-summary-card__icon">
                                <span class="material-icons" aria-hidden="true">person_outline</span>
                            </span>
                            <div class="agenda-summary-card__content">
                                <span class="agenda-summary-card__label">Responsável principal</span>
                                <strong class="agenda-summary-card__value">${escapeHtml(summary.topOwner.name)}</strong>
                                <span class="agenda-summary-card__meta">${escapeHtml(summary.topOwner.count)} follow-ups</span>
                            </div>
                        </article>
                    </section>

                    <section class="agenda-filters">
                        <label class="agenda-filter-field agenda-filter-field--search">
                            <span>Buscar follow-up</span>
                            <div class="agenda-filter-input">
                                <span class="material-icons" aria-hidden="true">search</span>
                                <input data-agenda-input="search" type="search" value="${escapeHtml(state.agendaSearch)}" placeholder="Buscar por proposta, cliente ou assunto">
                            </div>
                        </label>
                        <label class="agenda-filter-field">
                            <span>Período</span>
                            <div class="agenda-filter-input">
                                <span class="material-icons" aria-hidden="true">calendar_today</span>
                                <input data-agenda-input="period" type="text" value="${escapeHtml(rangeLabel)}" placeholder="10/07/2026 – 31/07/2026">
                            </div>
                        </label>
                        <label class="agenda-filter-field">
                            <span>Responsável</span>
                            <select data-agenda-select="responsavel">
                                ${AGENDA_RESPONSAVEIS.map((item) => `<option value="${escapeHtml(item)}" ${item === state.agendaResponsavel ? "selected" : ""}>${escapeHtml(item)}</option>`).join("")}
                            </select>
                        </label>
                        <label class="agenda-filter-field">
                            <span>Status</span>
                            <select data-agenda-select="status">
                                ${["Todos", ...FOLLOWUP_STATUSES].map((item) => `<option value="${escapeHtml(item)}" ${item === state.agendaStatus ? "selected" : ""}>${escapeHtml(item)}</option>`).join("")}
                            </select>
                        </label>
                        <div class="agenda-filters__actions">
                            <button class="agenda-button agenda-button--secondary" data-agenda-action="clear-filters" type="button">Limpar filtros</button>
                            <button class="agenda-button agenda-button--primary" data-agenda-action="apply-filters" type="button">Aplicar filtros</button>
                        </div>
                    </section>

                    <div class="agenda-layout">
                        <section class="agenda-main">
                            <div class="agenda-list-card">
                                <div class="agenda-list-card__header">
                                    <div class="agenda-list-card__title">
                                        <h3>Agenda por data</h3>
                                        <span class="agenda-list-card__badge">${totalFiltered} itens</span>
                                    </div>
                                </div>

                                <div class="agenda-groups">
                                    ${groups.length ? groups.map(renderAgendaGroup).join("") : `
                                        <div class="agenda-empty">
                                            <span class="material-icons" aria-hidden="true">event_busy</span>
                                            <p>Nenhum follow-up encontrado com os filtros atuais.</p>
                                        </div>
                                    `}
                                </div>

                                <div class="agenda-pagination">
                                    <span class="agenda-pagination__text">Mostrando ${pagedItems.start} a ${pagedItems.end} de ${totalFiltered} itens</span>
                                    <div class="agenda-pagination__controls">
                                        <button class="agenda-page-btn" data-agenda-action="prev-page" type="button" ${state.agendaPage === 1 ? "disabled" : ""}>
                                            <span class="material-icons" aria-hidden="true">chevron_left</span>
                                        </button>
                                        ${renderAgendaPageButtons(totalPages)}
                                        <button class="agenda-page-btn" data-agenda-action="next-page" type="button" ${state.agendaPage === totalPages ? "disabled" : ""}>
                                            <span class="material-icons" aria-hidden="true">chevron_right</span>
                                        </button>
                                    </div>
                                    <select class="agenda-pagination__select" data-agenda-select="per-page">
                                        ${[10, 20, 30].map((size) => `<option value="${size}" ${size === state.agendaPerPage ? "selected" : ""}>${size} por página</option>`).join("")}
                                    </select>
                                </div>
                            </div>
                        </section>

                        <aside class="agenda-side">
                            <section class="agenda-side-card">
                                <div class="agenda-side-card__header">
                                    <h3>Calendário</h3>
                                    <div class="agenda-calendar__nav">
                                        <button data-agenda-action="previous-month" type="button" aria-label="Mês anterior">
                                            <span class="material-icons" aria-hidden="true">chevron_left</span>
                                        </button>
                                        <span>Julho de 2026</span>
                                        <button data-agenda-action="next-month" type="button" aria-label="Próximo mês">
                                            <span class="material-icons" aria-hidden="true">chevron_right</span>
                                        </button>
                                    </div>
                                </div>
                                ${calendarMarkup}
                            </section>

                            <section class="agenda-side-card">
                                <div class="agenda-side-card__header">
                                    <div>
                                        <h3>Resumo do dia</h3>
                                        <p>${escapeHtml(formatAgendaSummaryDay(state.agendaSelectedDate))}</p>
                                    </div>
                                    <span class="agenda-side-card__badge">${selectedDayItems.length} itens</span>
                                </div>
                                <div class="agenda-day-summary">
                                    ${selectedDayItems.length ? selectedDayItems.map((item) => `
                                        <article class="agenda-day-summary__item">
                                            <span class="agenda-day-summary__dot"></span>
                                            <div>
                                                <strong>${escapeHtml(item.hora)} — ${escapeHtml(item.assunto)}</strong>
                                                <p>${escapeHtml(item.numeroProposta)} • ${escapeHtml(item.cliente)}</p>
                                            </div>
                                        </article>
                                    `).join("") : `<p class="agenda-day-summary__empty">Sem follow-ups para o dia selecionado.</p>`}
                                </div>
                                <button class="agenda-day-summary__link" data-agenda-action="view-day" type="button">Ver todos do dia</button>
                            </section>
                        </aside>
                    </div>
                </div>

                <div class="agenda-modal__footer">
                    <button class="agenda-button agenda-button--secondary" data-agenda-action="new-followup" type="button">
                        <span class="material-icons" aria-hidden="true">add</span>
                        Novo follow-up
                    </button>
                    <button class="agenda-button agenda-button--primary" data-agenda-action="close" type="button">Fechar</button>
                </div>
            </div>
        `;
    }

    function applyFollowupAgendaFilters() {
        state.agendaPage = 1;
        state.agendaDayFocus = "";
        renderFollowupAgenda();
    }

    function clearFollowupAgendaFilters() {
        state.agendaSearch = "";
        state.agendaResponsavel = "Todos";
        state.agendaStatus = "Todos";
        state.agendaPeriod = "2026-07-10|2026-07-31";
        state.agendaPage = 1;
        state.agendaPerPage = 10;
        state.agendaDayFocus = "";
        state.agendaSelectedDate = "2026-07-10";
        renderFollowupAgenda();
    }

    function selectAgendaDay(date) {
        state.agendaSelectedDate = date;
        renderFollowupAgenda();
    }

    function renderRevenueBars() {
        const total = revenueByStage.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        const tones = ["analysis", "preparation", "sent", "negotiation", "contracted"];
        refs.revenueBars.innerHTML = `
            <div class="revenue-phase-list">
                ${revenueByStage.map((item, index) => `
                    <div class="revenue-phase-row">
                        <div class="revenue-stage revenue-stage--${tones[index] || "closed"}">
                            <span>${index + 1}. ${escapeHtml(item.label)}</span>
                        </div>
                        <div class="revenue-value">${item.value}</div>
                    </div>
                `).join("")}
            </div>
            <div class="revenue-total">
                <span>Total estimado</span>
                <strong>${formatRevenueStageValue(total)}</strong>
            </div>
        `;
    }

    function renderProposalPanel() {
        const proposal = getSelectedProposal();
        if (!proposal) {
            refs.proposalDrawer.innerHTML = `<div class="empty-panel">Nenhuma proposta selecionada.</div>`;
            return;
        }

        refs.proposalDrawer.innerHTML = `
            <div class="proposal-panel__surface proposal-details-panel">
                <div class="proposal-panel__header proposal-details-header">
                    <div class="proposal-panel__title-row">
                        <div class="proposal-panel__title-group">
                            <p class="proposal-panel__eyebrow">Proposta comercial</p>
                            <div class="proposal-panel__title-line">
                                <h2 class="proposal-panel__title">${escapeHtml(proposal.numeroProposta)}</h2>
                                <span class="proposal-badge proposal-badge--header">REV ${escapeHtml(proposal.rev)}</span>
                                <span class="proposal-badge proposal-badge--header proposal-badge--status is-${getStatusTone(proposal.statusProposta)}">${escapeHtml(proposal.statusProposta)}</span>
                            </div>
                            <div class="proposal-panel__meta">
                                <span class="proposal-panel__meta-item">
                                    <span class="material-icons" aria-hidden="true">business</span>
                                    ${escapeHtml(proposal.empresa)}
                                </span>
                                <span class="proposal-panel__meta-dot" aria-hidden="true"></span>
                                <span>${escapeHtml(proposal.unidade || proposal.tipoOperacao || proposal.natureza)}</span>
                            </div>
                        </div>
                        <button class="proposal-panel__close" data-panel-action="close-panel" type="button" aria-label="Fechar">
                            <span class="material-icons" aria-hidden="true">close</span>
                        </button>
                    </div>
                    <div class="proposal-panel__actions proposal-panel__actions--streamlined">
                        <button class="panel-action panel-action--primary" data-panel-action="edit-data" type="button">
                            <span class="material-icons" aria-hidden="true">edit</span>
                            Editar proposta
                        </button>
                        <button class="panel-action panel-action--status" data-panel-action="focus-status" type="button">
                            <span class="material-icons" aria-hidden="true">edit_note</span>
                            Alterar status
                        </button>
                        <button class="panel-action panel-action--followup" data-panel-action="open-followup" type="button">
                            <span class="material-icons" aria-hidden="true">chat</span>
                            Registrar acompanhamento
                        </button>
                        <button class="panel-action panel-action--pdf" data-panel-action="generate-pdf" type="button">
                            <span class="material-icons" aria-hidden="true">picture_as_pdf</span>
                            PDF proposta
                        </button>
                        <button class="panel-action panel-action--pdf" data-panel-action="generate-critical-analysis-pdf" type="button">
                            <span class="material-icons" aria-hidden="true">fact_check</span>
                            PDF análise crítica
                        </button>
                    </div>
                </div>
                <div class="proposal-panel__tabs proposal-details-tabs">
                    ${renderPanelTab("resumo", "Resumo")}
                    ${renderPanelTab("dados", "Dados Comerciais")}
                    ${renderPanelTab("analise-critica", "Análise Crítica")}
                    ${renderPanelTab("escopo", "Escopo")}
                    ${renderPanelTab("documentos", "Documentos")}
                    ${renderPanelTab("followups", "Follow-ups")}
                    ${renderPanelTab("historico", "Histórico")}
                </div>
                <div class="proposal-panel__body proposal-details-body">
                    ${renderPanelBody(proposal)}
                </div>
            </div>
        `;

        refs.proposalDrawer.setAttribute("aria-hidden", "false");

        if (state.focusStatusSection) {
            window.setTimeout(() => {
                refs.proposalDrawer.querySelector("#statusSidebarCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
                state.focusStatusSection = false;
            }, 40);
        }

        updateStatusReasonState();
    }

    function renderPanelBody(proposal) {
        if (state.activeDetailTab === "dados") {
            return renderDadosComerciaisTab(proposal);
        }
        if (state.activeDetailTab === "analise-critica") {
            return renderCriticalAnalysisTab(proposal);
        }
        if (state.activeDetailTab === "escopo") {
            return renderEscopoTab(proposal);
        }
        if (state.activeDetailTab === "documentos") {
            return renderDocumentosTab(proposal);
        }
        if (state.activeDetailTab === "followups") {
            return renderFollowupsTabClean(proposal);
        }
        if (state.activeDetailTab === "historico") {
            return renderHistoricoTab(proposal);
        }
        return renderResumoCompact(proposal);
    }

    function renderResumoCompact(proposal) {
        const latestHistory = (proposal.historico || []).slice(0, 1);

        return `
            <div class="detail-layout detail-layout--overview">
                <div class="detail-main">
                    <section class="detail-card proposal-overview-card">
                        <div class="detail-card__heading">
                            <div>
                                <h3>Vis&atilde;o geral</h3>
                                <p>Informa&ccedil;&otilde;es essenciais para acompanhar esta proposta.</p>
                            </div>
                            <button class="inline-link-button" data-panel-action="edit-data" type="button">Ver dados comerciais</button>
                        </div>
                        <div class="proposal-overview-metrics">
                            ${renderSummaryItem("task_alt", "Status atual", proposal.statusProposta)}
                            ${renderSummaryItem("payments", "Receita estimada", proposal.estimativaReceita)}
                            ${renderSummaryItem("calendar_today", "Entrega da proposta", proposal.dataEntregaProposta)}
                            ${renderSummaryItem("person_outline", "Responsavel", proposal.responsavel)}
                        </div>
                        <div class="proposal-overview-context">
                            ${renderCompactItem("Cliente", proposal.empresa)}
                            ${renderCompactItem("Unidade / local", proposal.unidade || proposal.embarcacaoLocal || "Nao informado")}
                            ${renderCompactItem("Tipo de operacao", proposal.tipoOperacao || "Nao informado")}
                            ${renderCompactItem("Fase do pipeline", getStageMeta(proposal.kanbanStage).label)}
                        </div>
                    </section>

                    <section class="detail-card proposal-scope-card">
                        <div class="detail-card__heading">
                            <div>
                                <h3>Escopo e condi&ccedil;&otilde;es</h3>
                                <p>${escapeHtml(proposal.escopo || "Escopo nao informado.")}</p>
                            </div>
                            <button class="inline-link-button" data-panel-action="show-scope-toast" type="button">Ver escopo completo</button>
                        </div>
                        <div class="proposal-scope-card__meta">
                            ${renderCompactItem("Tempo de contrato", proposal.tempoContratoDias || "Nao informado")}
                            ${renderCompactItem("Previsao de contratacao", proposal.previsaoContratacao || "Nao informada")}
                            ${renderCompactItem("Proximo acompanhamento", proposal.followUp || "Sem acompanhamento")}
                        </div>
                    </section>
                </div>

                <aside class="detail-side">
                    <section class="detail-card status-sidebar" id="statusSidebarCard">
                        <h3>Atualizar status</h3>
                        <div class="status-field">
                            <label for="panelStatusSelect">Status da proposta</label>
                            <select id="panelStatusSelect">
                                ${renderOptions(STATUS_OPTIONS, proposal.statusProposta)}
                            </select>
                        </div>
                        <div class="status-field ${REASON_REQUIRED_STATUSES.has(proposal.statusProposta) ? "is-required" : ""} ${state.statusError ? "has-error" : ""}" id="statusReasonField">
                            <label for="panelReasonSelect">Motivo (quando aplicavel)</label>
                            <select id="panelReasonSelect">
                                ${renderOptions(MOTIVO_OPTIONS, proposal.motivoDeclinioPerda || "Selecione o motivo")}
                            </select>
                        </div>
                        <button class="panel-button panel-button--primary" data-panel-action="save-status" type="button">Salvar status</button>
                    </section>

                    <section class="detail-card detail-card--compact">
                        <div class="detail-card__heading">
                            <div>
                                <h3>&Uacute;ltima atualiza&ccedil;&atilde;o</h3>
                                <p>${latestHistory.length ? "Movimenta&ccedil;&atilde;o mais recente da proposta." : "Nenhuma movimenta&ccedil;&atilde;o registrada."}</p>
                            </div>
                            <button class="inline-link-button" data-panel-action="view-history" type="button">Hist&oacute;rico</button>
                        </div>
                        ${latestHistory.map((item) => `
                            <article class="timeline-entry timeline-entry--latest">
                                <div class="timeline-entry__date">${escapeHtml(item.dataHora.split(" ")[0])}</div>
                                <span class="timeline-entry__title">${escapeHtml(item.acao)}</span>
                                <div class="timeline-entry__user">${escapeHtml(item.usuario)}</div>
                            </article>
                        `).join("") || `<p class="detail-card__empty">Sem atualiza&ccedil;&otilde;es no momento.</p>`}
                    </section>
                </aside>
            </div>
        `;
    }

    function renderResumoTab(proposal) {
        return `
            <div class="detail-layout">
                <div class="detail-main">
                    <section class="detail-card">
                        <h3>Resumo da Proposta</h3>
                        <div class="summary-grid">
                            ${renderSummaryItem("business", "Cliente / Empresa", proposal.empresa)}
                            ${renderSummaryItem("inventory_2", "Unidade", proposal.unidade)}
                            ${renderSummaryItem("map", "UF", proposal.uf)}
                            ${renderSummaryItem("directions_boat", "Embarcação / Local", proposal.embarcacaoLocal)}
                            ${renderSummaryItem("adjust", "Natureza", proposal.natureza)}
                            ${renderSummaryItem("task_alt", "Status da Proposta", proposal.statusProposta)}
                            ${renderSummaryItem("view_kanban", "Fase do Pipeline", getStageMeta(proposal.kanbanStage).label)}
                            ${renderSummaryItem("stacked_bar_chart", "Heat Map", proposal.heatMap)}
                            ${renderSummaryItem("person_outline", "Responsável Comercial", proposal.responsavel)}
                            ${renderSummaryItem("calendar_today", "Data de entrega da proposta", proposal.dataEntregaProposta)}
                            ${renderSummaryItem("event_available", "Previsão de contratação", proposal.previsaoContratacao || "Não informada")}
                            ${renderSummaryItem("schedule", "Próximo Follow-up", proposal.followUp || "Sem follow-up")}
                            ${renderSummaryItem("payments", "Receita Estimada", proposal.estimativaReceita)}
                        </div>
                    </section>

                    <div class="two-up-grid">
                        <section class="detail-card">
                            <h3>Escopo Resumido</h3>
                            <p>${escapeHtml(proposal.escopo)}</p>
                            <button class="inline-link-button" data-panel-action="show-scope-toast" type="button">Ver escopo completo</button>
                        </section>
                        <section class="detail-card">
                            <h3>Informações Financeiras</h3>
                            <div class="info-kpis">
                                <div class="finance-item">
                                    <span class="material-icons" aria-hidden="true">payments</span>
                                    <div>
                                        <div class="value-field__label">Receita Estimada</div>
                                        <div class="value-field__value">${escapeHtml(proposal.estimativaReceita)}</div>
                                    </div>
                                </div>
                                <div class="finance-item">
                                    <span class="material-icons" aria-hidden="true">calendar_month</span>
                                    <div>
                                        <div class="value-field__label">Tempo de Contrato</div>
                                        <div class="value-field__value">${escapeHtml(proposal.tempoContratoDias)}</div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>

                    <section class="detail-card">
                        <h3>Informações Principais</h3>
                        <div class="compact-grid">
                            ${renderCompactItem("Nº da Proposta", proposal.numeroProposta)}
                            ${renderCompactItem("REV", proposal.rev)}
                            ${renderCompactItem("Emissão", proposal.emissao)}
                            ${renderCompactItem("Emissão Mês", proposal.emissaoMes)}
                            ${renderCompactItem("Responsável", proposal.responsavel)}
                            ${renderCompactItem("Natureza", proposal.natureza)}
                            ${renderCompactItem("Unidade", proposal.unidade)}
                            ${renderCompactItem("Heat Map", proposal.heatMap)}
                            ${renderCompactItem("Data Entrega Proposta", proposal.dataEntregaProposta)}
                            ${renderCompactItem("Data Solicitação", proposal.dataSolicitacaoProposta || "Não informada")}
                            ${renderCompactItem("Data Fechamento", proposal.dataFechamento || "Não informada")}
                            ${renderCompactItem("Previsão Contratação", proposal.previsaoContratacao || "Não informada")}
                            ${renderCompactItem("Follow-up", proposal.followUp || "Não informado")}
                            ${renderCompactItem("Empresa", proposal.empresa)}
                            ${renderCompactItem("UF", proposal.uf)}
                            ${renderCompactItem("Embarcação / Local", proposal.embarcacaoLocal)}
                            ${renderCompactItem("Solicitante", proposal.solicitante || "Não informado")}
                            ${renderCompactItem("Fonte do Lead", proposal.fonteLead || "Não informada")}
                            ${renderCompactItem("Segmento Cliente", proposal.segmentoCliente || "Não informado")}
                            ${renderCompactItem("PT", proposal.pt || "Não informado")}
                            ${renderCompactItem("PC / PTC", proposal.pcPtc || "Não informado")}
                            ${renderCompactItem("Análise Crítica", proposal.analiseCriticaResumo || proposal.analiseCriticaRealizada || "Pendente - 0 de 15 respondidas")}
                            ${renderCompactItem("Comentário", proposal.comentario || "Sem comentário")}
                        </div>
                    </section>
                </div>

                <aside class="detail-side">
                    <section class="detail-card status-sidebar" id="statusSidebarCard">
                        <h3>Resumo de Status</h3>
                        <div class="status-field">
                            <label for="panelStatusSelect">Alterar status da proposta</label>
                            <select id="panelStatusSelect">
                                ${renderOptions(STATUS_OPTIONS, proposal.statusProposta)}
                            </select>
                        </div>
                        <div class="status-field ${REASON_REQUIRED_STATUSES.has(proposal.statusProposta) ? "is-required" : ""} ${state.statusError ? "has-error" : ""}" id="statusReasonField">
                            <label for="panelReasonSelect">Motivo (quando aplicável)</label>
                            <select id="panelReasonSelect">
                                ${renderOptions(MOTIVO_OPTIONS, proposal.motivoDeclinioPerda || "Selecione o motivo")}
                            </select>
                        </div>
                        <button class="panel-button panel-button--primary" data-panel-action="save-status" type="button">Salvar status</button>
                    </section>

                    <section class="detail-card">
                        <h3>Linha do Tempo Rápida</h3>
                        <div class="timeline-quick">
                            ${proposal.historico.slice(0, 3).map((item) => `
                                <article class="timeline-entry">
                                    <div class="timeline-entry__date">${escapeHtml(item.dataHora.split(" ")[0])}</div>
                                    <span class="timeline-entry__title">${escapeHtml(item.acao)}</span>
                                    <div class="timeline-entry__user">${escapeHtml(item.usuario)}</div>
                                </article>
                            `).join("")}
                        </div>
                        <button class="inline-link-button" data-panel-action="view-history" type="button">Ver histórico completo</button>
                    </section>

                    <section class="detail-card note-box">
                        <h3>Notas Rápidas</h3>
                        ${state.noteEditMode ? `
                            <div class="edit-field">
                                <label for="panelQuickNote">Resumo da proposta</label>
                                <textarea id="panelQuickNote">${escapeHtml(proposal.comentario)}</textarea>
                            </div>
                            <div class="detail-actions-row">
                                <button class="panel-button panel-button--soft" data-panel-action="cancel-note" type="button">Cancelar</button>
                                <button class="panel-button panel-button--primary" data-panel-action="save-note" type="button">Editar nota</button>
                            </div>
                        ` : `
                            <p>${escapeHtml(proposal.comentario || "Sem nota rápida cadastrada.")}</p>
                            <div class="detail-actions-row">
                                <button class="panel-button panel-button--soft" data-panel-action="edit-note" type="button">Editar nota</button>
                            </div>
                        `}
                    </section>
                </aside>
            </div>
        `;
    }

    function renderDadosComerciaisTab(proposal) {
        return `
            <div class="detail-main">
                ${state.saveProposalError ? renderSaveProposalErrorBanner() : ""}
                <div class="detail-form-groups">
                     ${renderDataGroup("Identificação", [
                        editableField("Nº de Proposta", "numeroProposta", proposal.numeroProposta, false),
                        editableField("REV", "rev", proposal.rev, true, null, false, "number"),
                        editableField("Emissão", "emissao", proposal.emissao, false),
                        editableField("Emissão Mês", "emissaoMes", proposal.emissaoMes, false),
                        editableField("Responsável", "responsavel", proposal.responsavel, true, RESPONSAVEIS),
                        editableField("Natureza", "natureza", proposal.natureza, true, NATUREZAS),
                        editableField("Unidade", "unidade", proposal.unidade, true, getDetailSelectOptions("unidades", proposal.unidade)),
                        editableField("Heat Map", "heatMap", proposal.heatMap, true, HEATMAPS),
                        editableField("Status da Proposta", "statusProposta", proposal.statusProposta, true, STATUS_OPTIONS)
                    ])}
                    ${renderDataGroup("Datas", [
                        editableField("Data de entrega da proposta", "dataEntregaProposta", proposal.dataEntregaProposta, true),
                        editableField("Data de solicitação da proposta", "dataSolicitacaoProposta", proposal.dataSolicitacaoProposta, true),
                        editableField("Data de Fechamento", "dataFechamento", proposal.dataFechamento, true),
                        editableField("Previsão de contratação", "previsaoContratacao", proposal.previsaoContratacao, true),
                        editableField("Follow Up", "followUp", proposal.followUp, true)
                    ])}
                    ${renderDataGroup("Cliente", [
                        editableField("Empresa / Cliente", "empresa", proposal.empresa, true, getDetailSelectOptions("clientes", proposal.empresa)),
                        editableField("UF", "uf", proposal.uf, true, UFS),
                        editableField("Embarcação / Local", "embarcacaoLocal", proposal.embarcacaoLocal, true),
                        editableField("Fonte do Lead", "fonteLead", proposal.fonteLead, true, FONTE_LEAD),
                        editableField("Segmento Cliente", "segmentoCliente", proposal.segmentoCliente, true, SEGMENTOS)
                    ])}
                    ${renderDataGroup("Contato e Referência", [
                        editableField("Solicitante", "solicitante", proposal.solicitante, true),
                        editableField("E-mail", "emailSolicitante", proposal.emailSolicitante, true, null, false, "email"),
                        editableField("Telefone", "telefoneSolicitante", proposal.telefoneSolicitante, true, null, false, "tel"),
                        editableField("PO / Pedido", "po", proposal.po, true),
                        editableField("RFI", "rfi", proposal.rfi, true)
                    ], "detail-group--contact")}
                    ${renderDataGroup("Controle", [
                        editableField("Motivo de Declínio ou Perda", "motivoDeclinioPerda", proposal.motivoDeclinioPerda, true, MOTIVO_OPTIONS.slice(1)),
                        editableField("PT", "pt", proposal.pt, true),
                        editableField("PC / PTC", "pcPtc", proposal.pcPtc, true),
                        editableField("Comentário", "comentario", proposal.comentario, true, null, true)
                    ])}
                </div>
                ${state.dataEditMode ? `
                    <div class="detail-actions-row">
                        <button class="panel-button panel-button--soft" data-panel-action="cancel-data" type="button">Cancelar edição</button>
                        <button class="panel-button panel-button--primary" data-panel-action="save-data" type="button">Salvar alterações</button>
                    </div>
                ` : ""}
            </div>
        `;
    }

    function renderCriticalAnalysisTab(proposal) {
        return `
            <div class="detail-main critical-analysis-tab">
                ${state.saveProposalError ? renderSaveProposalErrorBanner() : ""}
                ${renderCriticalAnalysisDetail(proposal)}
                <div class="detail-actions-row critical-analysis-tab__actions">
                    ${state.criticalAnalysisEditMode ? `
                        <button class="panel-button panel-button--soft" data-panel-action="cancel-critical-analysis" type="button">Cancelar edição</button>
                        <button class="panel-button panel-button--primary" data-panel-action="save-critical-analysis" type="button">Salvar análise</button>
                    ` : `
                        <button class="panel-button panel-button--primary" data-panel-action="edit-critical-analysis" type="button">Editar análise crítica</button>
                    `}
                </div>
            </div>
        `;
    }

    function renderEscopoTab(proposal) {
        const scopeServices = getProposalScopeServices(proposal);
        return `
            <div class="detail-main">
                ${state.saveProposalError ? renderSaveProposalErrorBanner() : ""}
                <section class="detail-card">
                    <h3>Escopo da Proposta</h3>
                    ${state.scopeEditMode ? `
                        <div class="scope-edit-grid">
                            <div class="edit-field edit-field--span-two">
                                <label>Serviços / Escopos</label>
                                <div class="scope-services-editor">
                                    ${state.scopeDraftServices.map((service, index) => `
                                        <div class="scope-service-row" data-scope-service-row="${index}">
                                            <select data-scope-service-index="${index}">
                                                <option value="">Selecione o serviço</option>
                                                ${getScopeServiceOptions().map((option) => `
                                                    <option value="${escapeHtml(option)}" ${option === service ? "selected" : ""}>${escapeHtml(option)}</option>
                                                `).join("")}
                                            </select>
                                            <button class="panel-button panel-button--soft scope-service-row__remove" data-panel-action="remove-scope-service" data-scope-service-index="${index}" type="button">Remover</button>
                                        </div>
                                    `).join("")}
                                    <button class="panel-button panel-button--soft scope-services-editor__add" data-panel-action="add-scope-service" type="button">
                                        <span class="material-icons" aria-hidden="true">add</span>
                                        Adicionar escopo
                                    </button>
                                </div>
                            </div>
                            <div class="edit-field">
                                <label for="scopeReceita">Estimativa Receita</label>
                                <input id="scopeReceita" type="text" value="${escapeHtml(proposal.estimativaReceita)}">
                            </div>
                            <div class="edit-field">
                                <label for="scopeTempo">Tempo de contrato em dias</label>
                                <input id="scopeTempo" type="text" value="${escapeHtml(proposal.tempoContratoDias)}">
                            </div>
                        </div>
                        <section class="scope-items-editor">
                            <div class="scope-items-editor__heading">
                                <div>
                                    <h4>Equipamentos / Itens da Proposta</h4>
                                    <p>Inclua, altere ou remova os itens vinculados a esta proposta.</p>
                                </div>
                                <strong data-scope-items-total>${escapeHtml(formatCurrencyDisplay(getScopeDraftItemsTotal()))}</strong>
                            </div>
                            <div class="scope-items-editor__list">
                                ${state.scopeDraftItems.map((item, index) => renderScopeDraftItemRow(item, index)).join("")}
                            </div>
                            <div class="scope-items-editor__footer">
                                <button class="panel-button panel-button--soft" data-panel-action="add-scope-item" type="button">
                                    <span class="material-icons" aria-hidden="true">add</span>
                                    Adicionar item
                                </button>
                                <button class="proposal-inline-link" data-panel-action="open-scope-quick-item" type="button">Cadastrar item/equipamento</button>
                            </div>
                            ${state.scopeQuickItemOpen ? `
                                <div class="proposal-inline-card scope-items-editor__quick-create">
                                    <strong>Novo item / equipamento</strong>
                                    <label class="proposal-field proposal-field--inline">
                                        <span>Nome do item <em>*</em></span>
                                        <input id="scopeQuickItemName" type="text" placeholder="Digite o nome do item ou equipamento">
                                    </label>
                                    <div class="proposal-inline-card__actions">
                                        <button class="proposal-button proposal-button--secondary" data-panel-action="cancel-scope-quick-item" type="button">Cancelar</button>
                                        <button class="proposal-button proposal-button--primary" data-panel-action="save-scope-quick-item" type="button">Salvar item</button>
                                    </div>
                                </div>
                            ` : ""}
                        </section>
                        <div class="detail-actions-row">
                            <button class="panel-button panel-button--soft" data-panel-action="cancel-scope" type="button">Cancelar</button>
                            <button class="panel-button panel-button--primary" data-panel-action="save-scope" type="button">Salvar escopo</button>
                        </div>
                    ` : `
                        <div class="scope-services-display">
                            ${scopeServices.map((service) => `<span class="scope-services-display__tag">${escapeHtml(service)}</span>`).join("") || `<p>${escapeHtml(proposal.escopo)}</p>`}
                        </div>
                        <div class="info-kpis">
                            <div class="finance-item">
                                <span class="material-icons" aria-hidden="true">payments</span>
                                <div>
                                    <div class="value-field__label">Estimativa Receita</div>
                                    <div class="value-field__value">${escapeHtml(proposal.estimativaReceita)}</div>
                                </div>
                            </div>
                            <div class="finance-item">
                                <span class="material-icons" aria-hidden="true">schedule</span>
                                <div>
                                    <div class="value-field__label">Tempo de contrato</div>
                                    <div class="value-field__value">${escapeHtml(proposal.tempoContratoDias)}</div>
                                </div>
                            </div>
                        </div>
                        ${renderProposalCampoSummary(proposal)}
                        <div class="detail-actions-row detail-actions-row--scope">
                            <button class="panel-button panel-button--soft" data-panel-action="edit-scope" type="button">Editar escopo</button>
                        </div>
                    `}
                </section>
            </div>
        `;
    }

    function getScopeServiceOptions() {
        const options = commercialBootstrap?.metadata?.servicos;
        return Array.isArray(options) ? options.filter(Boolean) : [];
    }

    function getProposalScopeServices(proposal) {
        return String(proposal?.servico || proposal?.escopo || "")
            .split("|")
            .map((item) => item.trim())
            .filter(Boolean);
    }

    function syncScopeDraftServicesFromProposal(proposal) {
        const services = getProposalScopeServices(proposal);
        state.scopeDraftServices = services.length ? [...services] : [""];
    }

    function syncScopeDraftItemsFromProposal(proposal) {
        state.scopeDraftItems = Array.isArray(proposal?.campos) && proposal.campos.length
            ? proposal.campos.map((item) => ({
                item: String(item.nome || ""),
                unitPrice: Number(item.preco_unitario || 0) || 0,
                quantity: Number(item.quantidade || 1) || 1
            }))
            : [];
        state.scopeQuickItemOpen = false;
    }

    function createEmptyScopeDraftItem() {
        return { item: "", unitPrice: 0, quantity: 1 };
    }

    function getScopeDraftItemsTotal() {
        return (state.scopeDraftItems || []).reduce(
            (total, item) => total + ((Number(item.unitPrice) || 0) * (Number(item.quantity) || 0)),
            0
        );
    }

    function renderScopeDraftItemRow(item, index) {
        const subtotal = (Number(item.unitPrice) || 0) * (Number(item.quantity) || 0);
        return `
            <div class="proposal-item-row scope-items-editor__row" data-scope-item-row="${index}">
                <div class="proposal-item-field">
                    <label>Item / Equipamento</label>
                    <select data-scope-item-field="item" data-scope-item-index="${index}">
                        <option value="">Selecione o item</option>
                        ${renderProposalItemOptions(item.item)}
                    </select>
                </div>
                <div class="proposal-item-field">
                    <label>Preço unitário</label>
                    <div class="proposal-item-price">
                        <span>R$</span>
                        <input type="text" value="${escapeHtml(formatCurrencyInputValue(item.unitPrice))}" data-scope-item-field="unitPrice" data-scope-item-index="${index}" inputmode="decimal" placeholder="0,00">
                    </div>
                </div>
                <div class="proposal-item-field">
                    <label>Quantidade</label>
                    <input type="number" min="1" step="1" value="${escapeHtml(String(item.quantity || 1))}" data-scope-item-field="quantity" data-scope-item-index="${index}">
                </div>
                <div class="proposal-item-field">
                    <label>Subtotal</label>
                    <div class="proposal-item-subtotal" data-scope-item-subtotal="${index}">${escapeHtml(formatCurrencyDisplay(subtotal))}</div>
                </div>
                <button class="proposal-item-remove" data-panel-action="remove-scope-item" data-scope-item-index="${index}" type="button" aria-label="Remover item">
                    <span class="material-icons" aria-hidden="true">delete</span>
                </button>
            </div>
        `;
    }

    function addScopeDraftItem() {
        state.scopeDraftItems.push(createEmptyScopeDraftItem());
        renderProposalPanel();
    }

    function removeScopeDraftItem(index) {
        state.scopeDraftItems.splice(index, 1);
        renderProposalPanel();
    }

    function updateScopeDraftItem(index, field, value) {
        const item = state.scopeDraftItems[index];
        if (!item) return;
        if (field === "item") item.item = value;
        if (field === "unitPrice") item.unitPrice = parseCurrencyValue(value);
        if (field === "quantity") item.quantity = Math.max(1, Number(value) || 1);

        const subtotal = (Number(item.unitPrice) || 0) * (Number(item.quantity) || 0);
        const subtotalField = refs.proposalDrawer.querySelector(`[data-scope-item-subtotal="${index}"]`);
        if (subtotalField) subtotalField.textContent = formatCurrencyDisplay(subtotal);
        const total = refs.proposalDrawer.querySelector("[data-scope-items-total]");
        if (total) total.textContent = formatCurrencyDisplay(getScopeDraftItemsTotal());
    }

    function buildScopeDraftItemsPayload() {
        return (state.scopeDraftItems || [])
            .filter((item) => item.item || Number(item.unitPrice) > 0)
            .map((item) => ({
                nome: item.item,
                preco_unitario: Number(item.unitPrice || 0).toFixed(2),
                quantidade: String(Math.max(1, Number(item.quantity) || 1))
            }));
    }

    async function saveScopeQuickItem() {
        const input = refs.proposalDrawer.querySelector("#scopeQuickItemName");
        const nome = input?.value.trim() || "";
        if (!nome) {
            showNotification({
                type: "warning",
                title: "Informe o item",
                message: "Digite o nome do item ou equipamento para cadastrá-lo."
            });
            input?.focus();
            return;
        }

        try {
            const response = await fetchJson(state.endpoints.quickItemCreate, {
                method: "POST",
                body: JSON.stringify({ nome })
            });
            const item = response?.item || {};
            const choices = Array.isArray(commercialBootstrap?.metadata?.financeiroCampoChoices)
                ? commercialBootstrap.metadata.financeiroCampoChoices
                : [];
            if (!choices.some((choice) => choice.value === item.value)) {
                choices.push({
                    value: item.value,
                    label: item.label || item.value,
                    group: item.group || "Itens cadastrados"
                });
            }
            commercialBootstrap.metadata.financeiroCampoChoices = choices;
            applyFinanceiroCampoChoices(choices);
            state.scopeDraftItems.push({
                item: item.value,
                unitPrice: 0,
                quantity: 1
            });
            state.scopeQuickItemOpen = false;
            renderProposalPanel();
            showNotification({
                type: "success",
                title: "Item cadastrado com sucesso",
                message: "${item.label || item.value} foi adicionado à edição da proposta."
            });
        } catch (error) {
            showNotification({
                type: "warning",
                title: "Não foi possível cadastrar o item",
                message: error?.details?.nome || error.message || "Tente novamente."
            });
        }
    }

    function addScopeDraftService() {
        state.scopeDraftServices = [...(state.scopeDraftServices || []), ""];
        renderProposalPanel();
    }

    function removeScopeDraftService(index) {
        const nextServices = (state.scopeDraftServices || []).filter((_, serviceIndex) => serviceIndex !== index);
        state.scopeDraftServices = nextServices.length ? nextServices : [""];
        renderProposalPanel();
    }

    function updateScopeDraftService(index, value) {
        const nextServices = [...(state.scopeDraftServices || [])];
        nextServices[index] = value;
        state.scopeDraftServices = nextServices;
    }

    function renderProposalCampoSummary(proposal) {
        if (!Array.isArray(proposal.campos) || !proposal.campos.length) {
            return "";
        }

        return `
            <section class="scope-items-summary">
                <div class="scope-items-summary__header">
                    <h4>Equipamentos / Itens da Proposta</h4>
                    <strong>${escapeHtml(proposal.totalCamposFormatado || formatCurrencyDisplay(proposal.totalCampos || 0))}</strong>
                </div>
                <div class="scope-items-summary__list">
                    ${proposal.campos.map((campo) => `
                        <div class="scope-items-summary__row">
                            <div>
                                <strong>${escapeHtml(campo.label || campo.nome || "")}</strong>
                                <span>${escapeHtml(formatCurrencyDisplay(campo.preco_unitario || 0))} x ${escapeHtml(String(campo.quantidade || 0))}</span>
                            </div>
                            <strong>${escapeHtml(formatCurrencyDisplay(campo.subtotal || 0))}</strong>
                        </div>
                    `).join("")}
                </div>
            </section>
        `;
    }

    function renderFollowupsTab(proposal) {
        const form = state.followupFormOpen ? `
            <div class="followup-form followup-form--embedded">
                <h4>Registrar acompanhamento</h4>
                <div class="followup-form__grid">
                    ${renderInputField("Data do acompanhamento", "followupData", "", false)}
                    ${renderInputField("Hora", "followupHora", "", false)}
                    ${renderSelectField("Responsável", "followupResponsavel", proposal.responsavel, RESPONSAVEIS)}
                    ${renderSelectField("Tipo de contato", "followupTipo", FOLLOWUP_TYPES[0], FOLLOWUP_TYPES)}
                    ${renderInputField("Comentário / atualização", "followupComentario", "", false)}
                    ${renderInputField("Próxima ação", "followupAcao", "", false)}
                    ${renderInputField("Data prevista para próximo retorno", "followupDataAcao", "", false)}
                    ${renderSelectField("Status do acompanhamento", "followupStatus", FOLLOWUP_STATUSES[0], FOLLOWUP_STATUSES)}
                </div>
                <div class="detail-actions-row">
                    <button class="panel-button panel-button--soft" data-panel-action="cancel-followup" type="button">Cancelar</button>
                    <button class="panel-button panel-button--primary" data-panel-action="save-followup" type="button">Registrar acompanhamento</button>
                </div>
            </div>
        ` : "";

        return `
            <div class="detail-main detail-main--full">
                <section class="detail-card detail-card--followups">
                    <div class="followup-section__header">
                        <div class="followup-section__heading">
                            <h3>Acompanhamentos</h3>
                            <p class="followup-section__subtitle">Acompanhe os registros comerciais e atualize os próximos passos da proposta.</p>
                        </div>
                        ${state.followupFormOpen ? "" : `
                            <button class="panel-button panel-button--soft" data-panel-action="open-followup" type="button">
                                <span class="material-icons" aria-hidden="true">add</span>
                                Registrar acompanhamento
                            </button>
                        `}
                    </div>
                    ${form}
                    <div class="followup-timeline">
                        ${proposal.followUps.map((item) => `
                            <article class="followup-card">
                                <div class="followup-card__top">
                                    <div class="followup-card__dateblock">
                                        <span class="followup-card__date">${escapeHtml(item.data)}</span>
                                        <span class="followup-card__time">${escapeHtml(item.hora || "--:--")}</span>
                                    </div>
                                    <span class="followup-status ${slugify(item.status)}">${escapeHtml(item.status)}</span>
                                </div>
                                <div class="followup-card__meta">
                                    <strong>${escapeHtml(item.tipoContato)} - ${escapeHtml(item.responsavel)}</strong>
                                    <p>${escapeHtml(item.comentario)}</p>
                                    <p>Próxima ação: ${escapeHtml(item.proximaAcao || "Não informada")} ${item.dataProximaAcao ? `em ${escapeHtml(item.dataProximaAcao)}` : ""}</p>
                                </div>
                            </article>
                        `).join("")}
                    </div>
                </section>
            </div>
        `;
    }

    function renderDocumentosTab(proposal) {
        const attachments = Array.isArray(proposal.anexos) ? proposal.anexos : [];

        return `
            <div class="detail-main detail-main--full">
                <section class="detail-card proposal-documents-card">
                    <div class="detail-card__heading">
                        <div>
                            <h3>Documentos da proposta</h3>
                            <p>Anexe arquivos comerciais, técnicos e documentos de apoio.</p>
                        </div>
                        <button class="panel-button panel-button--primary" data-panel-action="upload-documents" type="button">
                            <span class="material-icons" aria-hidden="true">upload_file</span>
                            Anexar documentos
                        </button>
                        <input class="proposal-documents-input" data-proposal-attachments-input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.png,.jpg,.jpeg" hidden>
                    </div>
                    <p class="proposal-documents-card__hint">Formatos aceitos: PDF, Office, CSV, TXT e imagens. Limite de 20 MB por arquivo.</p>
                    ${attachments.length ? `
                        <div class="proposal-documents-list">
                            ${attachments.map((attachment) => `
                                <article class="proposal-document-row">
                                    <span class="material-icons proposal-document-row__icon" aria-hidden="true">description</span>
                                    <div class="proposal-document-row__details">
                                        <strong>${escapeHtml(attachment.nome || "Documento")}</strong>
                                        <span>${escapeHtml(formatAttachmentSize(attachment.tamanho))} · ${escapeHtml(attachment.criadoEm || "")}${attachment.enviadoPor ? ` · ${escapeHtml(attachment.enviadoPor)}` : ""}</span>
                                    </div>
                                    <div class="proposal-document-row__actions">
                                        <a class="panel-button panel-button--soft panel-button--compact" href="${escapeHtml(attachment.visualizarUrl)}" target="_blank" rel="noopener">
                                            <span class="material-icons" aria-hidden="true">visibility</span>
                                            Visualizar
                                        </a>
                                        <button class="panel-button panel-button--danger panel-button--compact" data-panel-action="delete-document" data-document-id="${attachment.id}" data-document-url="${escapeHtml(attachment.excluirUrl)}" type="button">
                                            <span class="material-icons" aria-hidden="true">delete_outline</span>
                                            Excluir
                                        </button>
                                    </div>
                                </article>
                            `).join("")}
                        </div>
                    ` : `
                        <div class="proposal-documents-empty">
                            <span class="material-icons" aria-hidden="true">folder_open</span>
                            <strong>Nenhum documento anexado</strong>
                            <p>Use “Anexar documentos” para incluir arquivos nesta proposta.</p>
                        </div>
                    `}
                </section>
            </div>
        `;
    }

    function formatAttachmentSize(size) {
        const bytes = Number(size) || 0;
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace(".", ",")} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
    }

    function renderFollowupsTabClean(proposal) {
        const form = state.followupFormOpen ? `
            <div class="followup-form followup-form--embedded">
                <h4>Registrar acompanhamento</h4>
                <div class="followup-form__grid">
                    ${renderInputField("Data do acompanhamento", "followupData", "", false)}
                    ${renderInputField("Hora", "followupHora", "", false)}
                    ${renderSelectField("Responsável", "followupResponsavel", proposal.responsavel, RESPONSAVEIS)}
                    ${renderSelectField("Tipo de contato", "followupTipo", FOLLOWUP_TYPES[0], FOLLOWUP_TYPES)}
                    ${renderInputField("Comentário / atualização", "followupComentario", "", false)}
                    ${renderInputField("Próxima ação", "followupAcao", "", false)}
                    ${renderInputField("Data prevista para próximo retorno", "followupDataAcao", "", false)}
                    ${renderSelectField("Status do acompanhamento", "followupStatus", FOLLOWUP_STATUSES[0], FOLLOWUP_STATUSES)}
                </div>
                <div class="detail-actions-row detail-actions-row--followup-form">
                    <button class="panel-button panel-button--soft" data-panel-action="cancel-followup" type="button">Cancelar</button>
                    <button class="panel-button panel-button--primary" data-panel-action="save-followup" type="button">Registrar acompanhamento</button>
                </div>
            </div>
        ` : "";

        return `
            <div class="detail-main detail-main--full">
                <section class="detail-card detail-card--followups">
                    <div class="followup-section__header">
                        <div class="followup-section__heading">
                            <h3>Acompanhamentos</h3>
                            <p class="followup-section__subtitle">Acompanhe os registros comerciais e atualize os próximos passos da proposta.</p>
                        </div>
                        ${state.followupFormOpen ? "" : `
                            <button class="panel-button panel-button--soft" data-panel-action="open-followup" type="button">
                                <span class="material-icons" aria-hidden="true">add</span>
                                Registrar acompanhamento
                            </button>
                        `}
                    </div>
                    ${form}
                    <div class="followup-timeline">
                        ${proposal.followUps.map((item) => `
                            <article class="followup-card">
                                <div class="followup-card__top">
                                    <div class="followup-card__dateblock">
                                        <span class="followup-card__date">${escapeHtml(item.data)}</span>
                                        <span class="followup-card__time">${escapeHtml(item.hora || "--:--")}</span>
                                    </div>
                                    <span class="followup-status ${slugify(item.status)}">${escapeHtml(item.status)}</span>
                                </div>
                                <div class="followup-card__meta">
                                    <strong>${escapeHtml(item.tipoContato)} - ${escapeHtml(item.responsavel)}</strong>
                                    <p>${escapeHtml(item.comentario)}</p>
                                    <div class="followup-card__details">
                                        <span>Próxima ação: ${escapeHtml(item.proximaAcao || "Não informada")}</span>
                                        <span>${item.dataProximaAcao ? `Data da próxima ação: ${escapeHtml(item.dataProximaAcao)}` : "Sem data futura definida"}</span>
                                    </div>
                                </div>
                            </article>
                        `).join("")}
                    </div>
                </section>
            </div>
        `;
    }

    function renderHistoricoTab(proposal) {
        return `
            <div class="detail-main">
                <section class="detail-card">
                    <h3>Histórico Completo</h3>
                    <div class="history-list">
                        ${proposal.historico.map((item) => `
                            <article class="history-card">
                                <div class="history-card__top">
                                    <span>${escapeHtml(item.dataHora)}</span>
                                    <span>${escapeHtml(item.usuario)}</span>
                                </div>
                                <span class="history-card__action">${escapeHtml(item.acao)}</span>
                                <div class="history-card__meta">${escapeHtml(item.detalhe)}</div>
                            </article>
                        `).join("")}
                    </div>
                </section>
            </div>
        `;
    }

    function renderSaveProposalErrorBanner() {
        return `
            <div class="detail-error-banner">
                <div class="detail-error-banner__copy">
                    <span class="material-icons" aria-hidden="true">warning</span>
                    <span>As alterações não foram salvas. Verifique os campos e tente novamente.</span>
                </div>
                <div class="detail-error-banner__actions">
                    <button class="panel-button panel-button--primary" data-panel-action="retry-save-error" type="button">Tentar salvar novamente</button>
                    <button class="panel-button panel-button--soft" data-panel-action="dismiss-save-error" type="button">Cancelar edição</button>
                </div>
            </div>
        `;
    }

    function showSaveProposalError() {
        state.saveProposalError = true;
        if (!state.selectedProposalId) {
            state.selectedProposalId = proposals[0]?.id ?? null;
        }
        state.activeDetailTab = ["escopo", "analise-critica"].includes(state.activeDetailTab) ? state.activeDetailTab : "dados";
        state.dataEditMode = state.activeDetailTab === "dados";
        state.criticalAnalysisEditMode = state.activeDetailTab === "analise-critica";
        state.scopeEditMode = state.activeDetailTab === "escopo";
        renderProposalPanel();
        refs.proposalDrawer.classList.add("is-open");
        refs.overlayBackdrop.classList.add("is-visible");
        document.body.classList.add("comercial-no-scroll");
        showNotification({
            type: "warning",
            title: "Erro ao salvar",
            message: "As alterações não foram salvas. Tente novamente."
        });
    }

    function retrySaveProposalChanges() {
        state.saveProposalError = false;
        if (state.activeDetailTab === "escopo") {
            saveScopeData();
            return;
        }
        if (state.activeDetailTab === "analise-critica") {
            saveCriticalAnalysis();
            return;
        }
        saveCommercialData();
    }

    function initErrorMocks() {
        window.comercialErrorMocks = {
            pipeline: showPipelineErrorState,
            emptyFilter: showEmptyFilterState,
            followups: showFollowupsErrorState,
            saveProposal: showSaveProposalError,
            createProposal: showCreateProposalError,
            connection: showConnectionUnavailableState
        };
    }

    function setButtonLoading(button, isLoading, label = "Carregando...") {
        if (!button) {
            return;
        }

        if (isLoading) {
            if (!button.dataset.originalLabel) {
                button.dataset.originalLabel = button.innerHTML;
            }
            button.disabled = true;
            button.classList.add("is-loading");
            button.setAttribute("aria-busy", "true");
            button.innerHTML = `
                <span class="btn-commercial__spinner" aria-hidden="true"></span>
                <span>${label}</span>
            `;
            return;
        }

        if (button.dataset.originalLabel) {
            button.innerHTML = button.dataset.originalLabel;
            delete button.dataset.originalLabel;
        }

        button.disabled = false;
        button.classList.remove("is-loading");
        button.removeAttribute("aria-busy");
    }

    function normalizeString(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim()
            .toLowerCase();
    }

    function normalizeStatusDisplay(value) {
        const normalized = normalizeString(value);
        const statusMap = {
            "em analise": "Em Análise",
            "avaliando escopo": "Avaliando escopo",
            "em elaboracao": "Em Elaboração",
            "aguardando aprovacao gestores": "Aguardando aprovação gestores",
            shortlist: "ShortList",
            revisada: "Revisada",
            enviada: "Enviada",
            "em negociacao": "Em Negociação",
            "fechada/contratada": "Fechada/Contratada",
            "perdida/recusada": "Perdida/Recusada",
            cancelada: "Cancelada",
            declinio: "Declínio",
            "sem retorno": "Sem Retorno"
        };

        return statusMap[normalized] || String(value || "");
    }

    function normalizeKanbanStage(value) {
        const normalized = normalizeString(value);
        const stageMap = {
            avaliacao_inicial: "avaliacao_inicial",
            "sem retorno": "avaliacao_inicial",
            "em analise": "avaliacao_inicial",
            "avaliando escopo": "avaliacao_inicial",
            preparacao_aprovacao: "preparacao_aprovacao",
            "em elaboracao": "preparacao_aprovacao",
            "aguardando aprovacao gestores": "preparacao_aprovacao",
            propostas_enviadas: "propostas_enviadas",
            shortlist: "propostas_enviadas",
            revisada: "propostas_enviadas",
            enviada: "propostas_enviadas",
            negociacao: "negociacao",
            "em negociacao": "negociacao",
            contratadas: "contratadas",
            "fechada/contratada": "contratadas",
            contratada: "contratadas",
            canceladas: "canceladas",
            cancelada: "canceladas"
        };

        return stageMap[normalized] || "";
    }

    function _normalizeStatusDisplayLegacy(value) {
        const normalized = normalizeString(value);
        const statusMap = {
            "em analise": "Em Análise",
            "avaliando escopo": "Avaliando escopo",
            "em elaboracao": "Em Elaboração",
            "aguardando aprovacao gestores": "Aguardando aprovação gestores",
            shortlist: "ShortList",
            revisada: "Revisada",
            enviada: "Enviada",
            "em negociacao": "Em Negociação",
            "fechada/contratada": "Fechada/Contratada",
            "perdida/recusada": "Perdida/Recusada",
            cancelada: "Cancelada",
            declinio: "Declínio",
            "sem retorno": "Sem Retorno"
        };

        return statusMap[normalized] || String(value || "");
    }

    function formatRevenueStageValue(value) {
        const amount = Number(value) || 0;
        if (amount >= 1000000) {
            return `R$ ${(amount / 1000000).toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })} mi`;
        }
        return formatCurrencyDisplay(amount);
    }

    function readCommercialBootstrap() {
        const node = document.getElementById("commercial-bootstrap");
        if (!node?.textContent) {
            return {};
        }

        try {
            return JSON.parse(node.textContent);
        } catch (error) {
            console.error("Falha ao ler bootstrap do Comercial:", error);
            return {};
        }
    }

    function replaceArrayContents(targetArray, nextItems) {
        targetArray.splice(0, targetArray.length, ...(nextItems || []));
    }

    function syncCommercialAppTotal() {
        const app = getCommercialAppElement?.();
        if (app) {
            app.dataset.totalPropostas = String(proposals.length);
        }
    }

    function applyFinanceiroCampoChoices(choices = []) {
        if (!Array.isArray(choices) || !choices.length) {
            return;
        }

        const groupedChoices = choices.reduce((accumulator, choice) => {
            const groupLabel = choice?.group || "Equipamentos e Taxas";
            if (!accumulator[groupLabel]) {
                accumulator[groupLabel] = [];
            }
            accumulator[groupLabel].push({
                value: String(choice?.value || ""),
                label: String(choice?.label || choice?.value || "")
            });
            return accumulator;
        }, {});

        replaceArrayContents(PROPOSAL_ITEM_GROUPS, Object.entries(groupedChoices).map(([label, options]) => ({
            label,
            options
        })));
    }

    function applyBootstrapData(bootstrap) {
        const metadata = bootstrap?.metadata || {};
        const proposalItems = Array.isArray(bootstrap?.proposals)
            ? bootstrap.proposals.map(hydrateProposal)
            : [];

        replaceArrayContents(proposals, proposalItems);
        syncCommercialAppTotal();

        if (Array.isArray(metadata.responsaveis) && metadata.responsaveis.length) {
            replaceArrayContents(RESPONSAVEIS, metadata.responsaveis);
        }

        if (Array.isArray(metadata.naturezas) && metadata.naturezas.length) {
            replaceArrayContents(NATUREZAS, metadata.naturezas);
        }

        if (Array.isArray(metadata.heatMaps) && metadata.heatMaps.length) {
            replaceArrayContents(HEATMAPS, metadata.heatMaps.map((item) => String(item?.value ?? item)));
        }

        if (Array.isArray(metadata.ufOptions) && metadata.ufOptions.length) {
            replaceArrayContents(UFS, metadata.ufOptions);
        }

        if (Array.isArray(metadata.fonteLeadOptions) && metadata.fonteLeadOptions.length) {
            replaceArrayContents(FONTE_LEAD, metadata.fonteLeadOptions);
        }

        if (Array.isArray(metadata.segmentoOptions) && metadata.segmentoOptions.length) {
            replaceArrayContents(SEGMENTOS, metadata.segmentoOptions);
        }

        if (Array.isArray(metadata.statusOptions) && metadata.statusOptions.length) {
            replaceArrayContents(STATUS_OPTIONS, metadata.statusOptions);
        }

        if (Array.isArray(metadata.financeiroCampoChoices) && metadata.financeiroCampoChoices.length) {
            applyFinanceiroCampoChoices(metadata.financeiroCampoChoices);
        }

        state.nextProposalNumber = Number(metadata.nextProposalNumber || 1) || 1;
        lockProposalNumberField();

        state.todayIso = bootstrap?.today || "2026-07-17";
        state.agendaDefaultPeriod = "";
        state.agendaPeriod = "";
        state.agendaSelectedDate = state.todayIso;
        state.endpoints = {
            create: bootstrap?.endpoints?.create || "",
            detailPattern: bootstrap?.endpoints?.detailPattern || "",
            statusPattern: bootstrap?.endpoints?.statusPattern || "",
            updatePattern: bootstrap?.endpoints?.updatePattern || "",
            pdfPattern: bootstrap?.endpoints?.pdfPattern || "",
            criticalAnalysisPdfPattern: bootstrap?.endpoints?.criticalAnalysisPdfPattern || "",
            documentReviewPattern: bootstrap?.endpoints?.documentReviewPattern || "",
            documentReviewSavePattern: bootstrap?.endpoints?.documentReviewSavePattern || "",
            attachmentListPattern: bootstrap?.endpoints?.attachmentListPattern || "",
            attachmentUploadPattern: bootstrap?.endpoints?.attachmentUploadPattern || "",
            quickClientCreate: bootstrap?.endpoints?.quickClientCreate || "",
            quickUnitCreate: bootstrap?.endpoints?.quickUnitCreate || "",
            quickMethodCreate: bootstrap?.endpoints?.quickMethodCreate || "",
            quickServiceCreate: bootstrap?.endpoints?.quickServiceCreate || "",
            quickItemCreate: bootstrap?.endpoints?.quickItemCreate || "",
            quickSegmentCreate: bootstrap?.endpoints?.quickSegmentCreate || "",
            catalogMetadata: bootstrap?.endpoints?.catalogMetadata || "",
            agendaList: bootstrap?.endpoints?.agendaList || "",
            agendaCreate: bootstrap?.endpoints?.agendaCreate || ""
        };

        refreshDashboardCollections(
            Array.isArray(bootstrap?.kpis) ? bootstrap.kpis : [],
            Array.isArray(bootstrap?.revenueByStage) ? bootstrap.revenueByStage : []
        );
    }

    function hydrateProposal(rawProposal = {}) {
        const rawStatus = rawProposal.statusProposta || "";
        const normalizedStatus = normalizeStatusDisplay(rawStatus);
        return createProposal(Number(rawProposal.id || rawProposal.propostaId || Date.now()), {
            ...rawProposal,
            id: Number(rawProposal.id || rawProposal.propostaId || Date.now()),
            numeroProposta: rawProposal.numeroProposta || rawProposal.numeroPropostaRaw || "",
            rev: String(rawProposal.rev || "00").padStart(2, "0"),
            statusProposta: normalizedStatus,
            kanbanStage: normalizeKanbanStage(rawProposal.kanbanStage || rawStatus),
            natureza: rawProposal.natureza || "",
            tipoOperacao: rawProposal.tipoOperacao || "",
            heatMap: String(rawProposal.heatMap ?? ""),
            estimativaReceitaValor: Number(rawProposal.estimativaReceitaValor ?? parseCurrencyValue(rawProposal.estimativaReceita)) || 0,
            estimativaReceita: rawProposal.estimativaReceita || formatCurrencyDisplay(rawProposal.estimativaReceitaValor || 0),
            tempoContratoDias: rawProposal.tempoContratoDias || "",
            tempoContratoDiasValor: Number(rawProposal.tempoContratoDiasValor || 0) || 0,
            followUps: Array.isArray(rawProposal.followUps) ? rawProposal.followUps : [],
            historico: Array.isArray(rawProposal.historico) ? rawProposal.historico : [],
            atrasada: Boolean(rawProposal.atrasada),
            campos: Array.isArray(rawProposal.campos) ? rawProposal.campos.map((campo) => ({
                id: Number(campo?.id || 0) || Date.now(),
                nome: String(campo?.nome || ""),
                label: String(campo?.label || campo?.nome || ""),
                preco_unitario: Number(campo?.preco_unitario || 0) || 0,
                quantidade: Number(campo?.quantidade || 0) || 0,
                subtotal: Number(campo?.subtotal || 0) || 0
            })) : [],
            totalCampos: Number(rawProposal.totalCampos || 0) || 0,
            totalCamposFormatado: rawProposal.totalCamposFormatado || formatCurrencyDisplay(rawProposal.totalCampos || 0)
        });
    }

    function upsertProposal(rawProposal) {
        const nextProposal = hydrateProposal(rawProposal);
        const currentIndex = proposals.findIndex((proposal) => proposal.id === nextProposal.id);
        if (currentIndex >= 0) {
            proposals.splice(currentIndex, 1, {
                ...proposals[currentIndex],
                ...nextProposal,
                followUps: nextProposal.followUps?.length ? nextProposal.followUps : proposals[currentIndex].followUps,
                historico: nextProposal.historico?.length ? nextProposal.historico : proposals[currentIndex].historico,
                campos: Array.isArray(nextProposal.campos) ? nextProposal.campos : proposals[currentIndex].campos,
                totalCampos: Number(nextProposal.totalCampos || 0) || 0,
                totalCamposFormatado: nextProposal.totalCamposFormatado || proposals[currentIndex].totalCamposFormatado
            });
        } else {
            proposals.unshift(nextProposal);
        }
        syncCommercialAppTotal();
        refreshDashboardCollections();
        return proposals.find((proposal) => proposal.id === nextProposal.id) || nextProposal;
    }

    function refreshDashboardCollections(serverKpis = [], serverRevenue = []) {
        if (Array.isArray(serverKpis) && serverKpis.length) {
            replaceArrayContents(kpis, serverKpis);
        } else {
            replaceArrayContents(kpis, buildKpisFromProposals());
        }

        if (Array.isArray(serverRevenue) && serverRevenue.length) {
            replaceArrayContents(revenueByStage, serverRevenue);
        } else {
            replaceArrayContents(revenueByStage, buildRevenueByStageFromProposals());
        }


    }

    function buildKpisFromProposals() {
        const today = new Date(state.todayIso || new Date().toISOString());
        const total = proposals.length;
        const receitaTotal = proposals.reduce((sum, proposal) => sum + (Number(proposal.estimativaReceitaValor) || 0), 0);
        const propostasMes = proposals.filter((proposal) => {
            const emission = parseBrazilianDate(proposal.emissao);
            return emission && emission.getFullYear() === today.getFullYear() && emission.getMonth() === today.getMonth();
        }).length;
        const aguardandoAprovacao = proposals.filter((proposal) => ["aguardando aprovacao gestores", "aguardando aprovacao dos gestores"].includes(normalizeString(proposal.statusProposta))).length;
        const contratadas = proposals.filter((proposal) => ["fechada/contratada", "fechada / contratada", "contratada"].includes(normalizeString(proposal.statusProposta))).length;
        const canceladas = proposals.filter((proposal) => normalizeString(proposal.statusProposta) === "cancelada").length;

        return [
            { icon: "description", title: "Total de Propostas", value: String(total), filterType: "all" },
            { icon: "payments", title: "Receita Estimada Total", value: formatCurrencyDisplay(receitaTotal) },
            { icon: "calendar_month", title: "Propostas no Mês", value: String(propostasMes), filterType: "propostas-mes" },
            { icon: "approval", title: "Aguardando Aprovação", value: String(aguardandoAprovacao), filterType: "aguardando-aprovacao", attention: true },
            { icon: "check_circle", title: "Contratadas", value: String(contratadas), filterType: "contratadas" },
            { icon: "cancel", title: "Canceladas", value: String(canceladas), filterType: "canceladas" }
        ];
    }

    function buildRevenueByStageFromProposals() {
        const totals = Object.fromEntries(COLUMN_DEFINITIONS.map((column) => [column.key, 0]));

        proposals.forEach((proposal) => {
            if (Object.prototype.hasOwnProperty.call(totals, proposal.kanbanStage)) {
                totals[proposal.kanbanStage] += Number(proposal.estimativaReceitaValor) || 0;
            }
        });

        return COLUMN_DEFINITIONS.map((column) => ({
            key: column.key,
            label: column.label,
            value: formatRevenueStageValue(totals[column.key]),
            amount: totals[column.key],
            highlight: column.key === "contratadas"
        }));
    }

    function hydrateCommercialFormOptions() {
        const metadata = commercialBootstrap?.metadata || {};

        populateSelect("proposalResponsavel", metadata.responsaveis || RESPONSAVEIS, { placeholder: "Selecione o responsável" });
        populateSelect("proposalNatureza", metadata.naturezas || NATUREZAS, { placeholder: "Selecione a natureza" });
        populateSelect("proposalUnidade", metadata.unidades || [], { placeholder: "Selecione a unidade" });
        populateSelect("proposalTipoOperacao", metadata.tipoOperacaoOptions || ["Onshore", "Offshore"], { placeholder: "Selecione o tipo de operação" });
        populateSelect("proposalMetodo", metadata.metodoOptions || [], { placeholder: "Selecione o método" });
        populateSelect("proposalCoordenador", metadata.coordenadorOptions || [], { placeholder: "Selecione o coordenador" });
        populateSelect("proposalStatus", metadata.statusOptions || STATUS_OPTIONS, { placeholder: "Selecione o status" });
        populateSelect("proposalHeatMap", metadata.heatMaps || [], { placeholder: "Selecione o heat map", valueKey: "value", labelKey: "label" });
        populateSelect("proposalCliente", metadata.clientes || [], { placeholder: "Selecione o cliente" });
        populateSelect("proposalUf", metadata.ufOptions || UFS, { placeholder: "Selecione a UF" });
        populateSelect("proposalSegmento", metadata.segmentoOptions || SEGMENTOS, { placeholder: "Selecione o segmento" });
        populateSelect("proposalFonteLead", metadata.fonteLeadOptions || FONTE_LEAD, { placeholder: "Selecione a fonte do lead" });
        populateSelect("proposalMotivo", metadata.motivoPerdaOptions || MOTIVO_OPTIONS.slice(1), { placeholder: "Selecione o motivo" });
        populateSelect("proposalPt", metadata.ptOptions || [], { placeholder: "Selecione o PT" });
        populateSelect("proposalPc", metadata.pcOptions || [], { placeholder: "Selecione o PC / PTC" });
        renderProposalServiceRows();
        renderCriticalAnalysisControls();
    }

    function renderCriticalAnalysisControls() {
        document.querySelectorAll("[data-critical-question]").forEach((question) => {
            const fieldName = question.dataset.criticalQuestion;
            const answerContainer = question.querySelector(".critical-analysis__answers");
            if (!fieldName || !answerContainer) {
                return;
            }
            const selected = state.criticalAnalysisAnswers[fieldName] || "";
            answerContainer.innerHTML = CRITICAL_ANALYSIS_OPTIONS.map((option) => `
                <label class="critical-analysis__option ${selected === option.value ? "is-selected" : ""}">
                    <input type="radio" name="critical-${fieldName}" value="${option.value}" data-critical-analysis-field="${fieldName}" ${selected === option.value ? "checked" : ""}>
                    <span>${option.label}</span>
                </label>
            `).join("");
        });
        updateCriticalAnalysisProgress();
    }

    function getCriticalAnalysisPayload() {
        const answers = {};
        CRITICAL_ANALYSIS_FIELDS.forEach((fieldName) => {
            answers[fieldName] = state.criticalAnalysisAnswers[fieldName] || "";
        });
        return {
            respostas: answers,
            comentario: document.getElementById("proposalAnaliseComentario")?.value?.trim() || ""
        };
    }

    function updateCriticalAnalysisProgress() {
        const willNotParticipate = proposalWillNotParticipate();
        const answered = CRITICAL_ANALYSIS_FIELDS.filter((fieldName) =>
            ["SIM", "NAO", "NA"].includes(state.criticalAnalysisAnswers[fieldName])
        ).length;
        const completed = answered === CRITICAL_ANALYSIS_FIELDS.length;
        const badge = document.getElementById("criticalAnalysisStatusBadge");
        const progress = document.getElementById("criticalAnalysisProgress");
        if (badge) {
            badge.textContent = completed ? "Realizada" : "Pendente";
            badge.classList.toggle("is-realized", completed);
            badge.classList.toggle("is-pending", !completed);
        }
        if (progress) {
            progress.textContent = `${answered} de ${CRITICAL_ANALYSIS_FIELDS.length} perguntas respondidas`;
        }
        refs.newProposalModal?.classList.toggle("is-not-participating", willNotParticipate);
    }

    function populateSelect(selectId, options, config = {}) {
        const select = document.getElementById(selectId);
        if (!select) {
            return;
        }

        const {
            placeholder = "",
            selectedValue = Object.prototype.hasOwnProperty.call(config, "selectedValue")
                ? config.selectedValue
                : (select.value || select.dataset.selectedValue || ""),
            valueKey = null,
            labelKey = null
        } = config;

        const normalizedOptions = (options || []).map((option) => {
            if (option && typeof option === "object") {
                return {
                    value: String(valueKey ? option[valueKey] : option.value ?? option.label ?? ""),
                    label: String(labelKey ? option[labelKey] : option.label ?? option.value ?? "")
                };
            }
            return {
                value: String(option ?? ""),
                label: String(option ?? "")
            };
        }).filter((option) => option.value);

        select.innerHTML = `
            ${placeholder ? `<option value="">${escapeHtml(placeholder)}</option>` : ""}
            ${normalizedOptions.map((option) => `
                <option value="${escapeHtml(option.value)}" ${option.value === selectedValue ? "selected" : ""}>${escapeHtml(option.label)}</option>
            `).join("")}
        `;
    }

    async function refreshCommercialCatalogs() {
        if (!state.endpoints.catalogMetadata) {
            return;
        }

        const response = await fetchJson(state.endpoints.catalogMetadata);
        const metadata = response?.metadata;
        if (!metadata || typeof metadata !== "object") {
            return;
        }

        commercialBootstrap.metadata = {
            ...(commercialBootstrap.metadata || {}),
            ...metadata
        };
        hydrateCommercialFormOptions();
    }

    function buildEndpoint(pattern, proposalId) {
        return String(pattern || "").replace("__id__", String(proposalId));
    }

    function getCsrfToken() {
        const cookies = document.cookie ? document.cookie.split(";") : [];
        for (const cookie of cookies) {
            const trimmed = cookie.trim();
            if (trimmed.startsWith("csrftoken=")) {
                return decodeURIComponent(trimmed.slice("csrftoken=".length));
            }
        }
        return "";
    }

    async function fetchJson(url, options = {}) {
        const response = await fetch(url, {
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": getCsrfToken(),
                ...(options.headers || {})
            },
            ...options
        });

        let payload = {};
        try {
            payload = await response.json();
        } catch (error) {
            payload = {};
        }

        if (!response.ok) {
            const message = payload?.message || "Não foi possível concluir a operação.";
            const error = new Error(message);
            error.details = payload?.errors || {};
            throw error;
        }

        return payload;
    }

    async function persistProposalUpdate(proposalId, payload) {
        const endpoint = buildEndpoint(state.endpoints.updatePattern, proposalId);
        if (!endpoint) {
            throw new Error("O endpoint de atualização da proposta não foi configurado.");
        }

        const response = await fetchJson(endpoint, {
            method: "POST",
            body: JSON.stringify(payload)
        });

        const updatedProposal = upsertProposal(response?.proposal || {});
        renderAll();
        renderProposalPanel();
        return updatedProposal;
    }

    function hydrateFilters() {
        const getUniqueValues = (resolver) => [...new Set(
            proposals
                .map((proposal) => resolver(proposal))
                .filter((value) => value !== null && value !== undefined && String(value).trim() !== "")
        )].sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));

        refs.filterStatus.innerHTML = `
            <option value="">Todos</option>
            ${COLUMN_DEFINITIONS.map((column) => `<option value="${column.key}">${column.label}</option>`).join("")}
        `;
        refs.filterNatureza.innerHTML = `
            <option value="">Todas</option>
            ${getUniqueValues((proposal) => proposal.natureza).map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}
        `;
        refs.filterStatusProposta.innerHTML = `
            <option value="">Todos</option>
            ${getUniqueValues((proposal) => proposal.statusProposta).map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}
        `;
        refs.filterTipoOperacao.innerHTML = `
            <option value="">Todos</option>
            ${getUniqueValues((proposal) => proposal.tipoOperacao).map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}
        `;
        refs.filterResponsavel.innerHTML = `
            <option value="">Todos</option>
            ${getUniqueValues((proposal) => proposal.responsavel).map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}
        `;
        refs.filterUf.innerHTML = `
            <option value="">Todas</option>
            ${getUniqueValues((proposal) => proposal.uf).map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}
        `;
        refs.filterSegmentoCliente.innerHTML = `
            <option value="">Todos</option>
            ${getUniqueValues((proposal) => proposal.segmentoCliente).map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}
        `;
        refs.filterFonteLead.innerHTML = `
            <option value="">Todas</option>
            ${getUniqueValues((proposal) => proposal.fonteLead).map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}
        `;
        refs.filterHeatMap.innerHTML = `
            <option value="">Todos</option>
            ${getUniqueValues((proposal) => proposal.heatMap).map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}
        `;
        refs.filterMotivoPerda.innerHTML = `
            <option value="">Todos</option>
            ${getUniqueValues((proposal) => proposal.motivoDeclinioPerda).map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}
        `;
    }

    function renderCriticalAnalysisDetail(proposal) {
        const analysis = proposal.analiseCriticaOportunidade || {};
        const answers = analysis.respostas || {};
        const total = Number(analysis.totalPerguntas) || CRITICAL_ANALYSIS_FIELDS.length;
        const answered = Number(analysis.quantidadeRespondida) || 0;
        const completed = Boolean(analysis.realizada);
        return `
            <section class="detail-group critical-analysis-detail">
                <div class="detail-group__header">
                    <div><h3>Análise Crítica da Oportunidade</h3><p>Status calculado pelas respostas registradas.</p></div>
                    <div class="critical-analysis__status"><strong class="critical-analysis__badge ${completed ? "is-realized" : "is-pending"}">${completed ? "Realizada" : "Pendente"}</strong><small>${answered} de ${total} perguntas respondidas</small></div>
                </div>
                <div class="critical-analysis__questions">
                    ${CRITICAL_ANALYSIS_FIELDS.map((fieldName, index) => `
                        <div class="critical-analysis__question">
                            <p>${index + 1}. ${escapeHtml(getCriticalAnalysisQuestionLabel(fieldName))}</p>
                            <div class="critical-analysis__answers">
                                ${CRITICAL_ANALYSIS_OPTIONS.map((option) => `
                                    <label class="critical-analysis__option ${answers[fieldName] === option.value ? "is-selected" : ""}">
                                        <input type="radio" name="edit-critical-${fieldName}" value="${option.value}" data-critical-edit-field="${fieldName}" ${answers[fieldName] === option.value ? "checked" : ""} ${state.criticalAnalysisEditMode ? "" : "disabled"}>
                                        <span>${option.label}</span>
                                    </label>
                                `).join("")}
                            </div>
                        </div>
                    `).join("")}
                </div>
                <label class="edit-field critical-analysis__comment"><span>Comentário da Análise Crítica</span><textarea data-edit-analysis-comment ${state.criticalAnalysisEditMode ? "" : "readonly"} placeholder="Adicione uma observação complementar, se necessário.">${escapeHtml(analysis.comentario || "")}</textarea></label>
            </section>
        `;
    }

    function getCriticalAnalysisQuestionLabel(fieldName) {
        const labels = {
            capacidade_atender_requisitos: "Nossa empresa possui capacidade para atender integralmente aos requisitos do cliente?",
            habilitacao_tecnica_atendida: "Os requisitos de habilitação técnica exigidos para esta oportunidade são atendidos?",
            visita_tecnica_necessaria: "É necessária visita técnica?",
            escopo_claramente_definido: "O escopo está claramente definido?",
            competencia_tecnica_execucao: "Possuímos competência técnica para executar?",
            recursos_disponiveis: "Os recursos humanos, materiais e equipamentos necessários para execução do contrato estão disponíveis e atendem aos requisitos do cliente?",
            equipe_com_treinamentos: "A equipe possui os treinamentos necessários para a atividade?",
            equipe_irata_disponivel: "Quando aplicável, a empresa possui equipe IRATA disponível?",
            equipe_resgate_disponivel: "Quando aplicável, a empresa possui equipe de resgate disponível?",
            tempo_habil_mobilizacao: "Existe tempo hábil para mobilização na data solicitada pelo cliente?",
            tempo_habil_aquisicao: "Existe tempo hábil para aquisição de materiais ou equipamentos específicos, quando aplicável?",
            riscos_comerciais_relevantes: "O contrato apresenta riscos comerciais relevantes?",
            oportunidade_viavel_rentavel: "A oportunidade é comercialmente viável e rentável para a empresa?",
            pendencias_financeiras_cliente: "Existem pendências financeiras do cliente junto à Ambipar?",
            iremos_participar: "Iremos participar?"
        };
        return labels[fieldName] || fieldName;
    }

    function getCriticalAnalysisEditPayload() {
        const answers = {};
        CRITICAL_ANALYSIS_FIELDS.forEach((fieldName) => {
            answers[fieldName] = refs.proposalDrawer.querySelector(`[data-critical-edit-field="${fieldName}"]:checked`)?.value || "";
        });
        return {
            respostas: answers,
            comentario: refs.proposalDrawer.querySelector("[data-edit-analysis-comment]")?.value?.trim() || ""
        };
    }

    function saveCriticalAnalysis() {
        const proposal = getSelectedProposal();
        if (!proposal) return;

        persistProposalUpdate(proposal.id, {
            analise_critica_oportunidade: getCriticalAnalysisEditPayload(),
            history_entry: {
                usuario: proposal.responsavel,
                acao: "Análise crítica atualizada",
                detalhe: "As respostas da análise crítica foram atualizadas no painel."
            }
        }).then(() => {
            state.criticalAnalysisEditMode = false;
            state.saveProposalError = false;
            renderProposalPanel();
            showNotification({
                type: "success",
                title: "Análise crítica salva",
                message: "As respostas da oportunidade foram atualizadas."
            });
        }).catch((error) => {
            state.saveProposalError = true;
            renderProposalPanel();
            showNotification({
                type: "warning",
                title: "Erro ao salvar",
                message: Object.values(error.details || {}).join(" ") || error.message || "Não foi possível atualizar a análise crítica."
            });
        });
    }

    function getStatusTone(status) {
        const value = normalizeString(status);
        if (["em analise", "avaliando escopo", "sem retorno"].includes(value)) return "analysis";
        if (["em elaboracao", "aguardando aprovacao gestores"].includes(value)) return "preparation";
        if (["revisada", "shortlist", "enviada"].includes(value)) return "sent";
        if (value === "em negociacao") return "negotiation";
        if (["fechada/contratada", "contratada"].includes(value)) return "contracted";
        if (value === "cancelada") return "cancelled";
        return "closed";
    }

    async function openProposalPanel(id) {
        state.selectedProposalId = id;
        state.activeDetailTab = "resumo";
        state.dataEditMode = false;
        state.criticalAnalysisEditMode = false;
        state.scopeEditMode = false;
        state.noteEditMode = false;
        state.followupFormOpen = false;
        state.statusError = false;
        refs.proposalDrawer.classList.add("is-open");
        refs.overlayBackdrop.classList.add("is-visible");
        document.body.classList.add("comercial-no-scroll");
        renderProposalPanel();

        const detailUrl = buildEndpoint(state.endpoints.detailPattern, id);
        if (!detailUrl) {
            return;
        }

        try {
            const payload = await fetchJson(detailUrl, { method: "GET", headers: {} });
            if (payload?.proposal) {
                upsertProposal(payload.proposal);
                renderAll();
                renderProposalPanel();
            }
        } catch (error) {
            showNotification({
                type: "warning",
                title: "Detalhes indisponíveis",
                message: error.message || "Não foi possível carregar os detalhes reais da proposta."
            });
        }
    }

    function closeProposalPanel() {
        refs.proposalDrawer.classList.remove("is-open");
        refs.proposalDrawer.setAttribute("aria-hidden", "true");
        state.dataEditMode = false;
        state.criticalAnalysisEditMode = false;
        state.scopeEditMode = false;
        state.noteEditMode = false;
        state.followupFormOpen = false;
        syncOverlayState();
    }

    function openProposalModal() {
        resetModalState();
        refreshProposalNumberField();
        refs.newProposalModal.classList.add("is-open");
        refs.newProposalModal.setAttribute("aria-hidden", "false");
        refs.overlayBackdrop.classList.add("is-visible");
        document.body.classList.add("comercial-no-scroll");
        syncOverlayState();
    }

    function generateProposalPdf(kind = "proposta") {
        const proposal = getSelectedProposal();
        const isCriticalAnalysis = kind === "analise-critica";
        const endpoint = buildEndpoint(
            isCriticalAnalysis ? state.endpoints.criticalAnalysisPdfPattern : state.endpoints.pdfPattern,
            proposal?.id
        );
        if (!proposal || !endpoint) {
            showNotification({
                type: "warning",
                title: "PDF indisponível",
                message: "Não foi possível identificar a proposta para gerar o documento."
            });
            return;
        }

        const filenamePrefix = isCriticalAnalysis ? "analise_critica_proposta" : "proposta";
        downloadProposalPdf(endpoint, `${filenamePrefix}_${proposal.numeroProposta || proposal.id}.pdf`, isCriticalAnalysis ? "Análise crítica" : "Proposta");
    }

    async function previewProposalPdf(endpoint, finalEndpoint, filename) {
        const loading = document.createElement("div");
        loading.className = "proposal-preview-loading";
        loading.setAttribute("role", "status");
        loading.setAttribute("aria-live", "polite");
        loading.innerHTML = `<span class="proposal-preview-loading__spinner" aria-hidden="true"></span><div><strong>Preparando pré-visualização</strong><span>Gerando o documento para conferência...</span></div>`;
        document.body.appendChild(loading);
        try {
        const response = await fetch(endpoint, {
            credentials: "same-origin",
            headers: { "X-Requested-With": "XMLHttpRequest" },
        });

        if (!response.ok) {
            const rawMessage = await response.text();
            let message = rawMessage;
            try {
                const payload = JSON.parse(rawMessage);
                message = payload.message || payload.error || rawMessage;
            } catch (_) {
                // Respostas legadas podem não ser JSON; preservamos a mensagem recebida.
            }
            throw new Error(message || "Não foi possível gerar a pré-visualização.");
        }

        const payload = await response.json();
        if (!payload.success || !Array.isArray(payload.pages) || !payload.pages.length) {
            throw new Error("Não foi possível carregar as páginas da pré-visualização.");
        }

        let currentPage = 0;
        let zoom = 1;
        const pendingSections = payload.pending_sections || [];
        const canGenerate = Boolean(payload.can_generate);
        const generationHint = canGenerate
            ? "A prévia não realiza download nem altera a emissão oficial."
            : `Para emitir o PDF, confirme: ${pendingSections.join(", ")}.`;
        const viewer = document.createElement("section");
        viewer.className = "proposal-pdf-preview";
        viewer.innerHTML = `<div class="proposal-pdf-preview__dialog" role="dialog" aria-modal="true" aria-label="Pré-visualização da proposta"><header><div class="proposal-pdf-preview__brand"><span><img src="/static/img/logo_ia_branco.png" alt="Synchro AI"></span><div><p>Synchro AI · Conferência documental</p><h2>Pré-visualização da proposta</h2><small>Revise cada página antes de emitir a versão oficial.</small></div></div><button type="button" aria-label="Fechar pré-visualização" data-pdf-preview-close>×</button></header><main><div class="proposal-pdf-preview__toolbar"><div><button type="button" data-pdf-preview-page="previous" aria-label="Página anterior">‹</button><strong data-pdf-preview-position></strong><button type="button" data-pdf-preview-page="next" aria-label="Próxima página">›</button></div><div class="proposal-pdf-preview__zoom"><button type="button" data-pdf-preview-zoom="out" aria-label="Diminuir zoom">−</button><strong data-pdf-preview-zoom-value>100%</strong><button type="button" data-pdf-preview-zoom="in" aria-label="Aumentar zoom">+</button></div></div><div class="proposal-pdf-preview__page"><img data-pdf-preview-image alt="Página da proposta em pré-visualização"></div></main><footer><div class="proposal-pdf-preview__hint ${canGenerate ? "" : "is-pending"}">${escapeHtml(generationHint)}</div><div><button type="button" data-pdf-preview-close>Voltar para revisão</button><button type="button" class="proposal-pdf-preview__generate" data-pdf-preview-generate ${canGenerate ? "" : "disabled"}>Gerar PDF oficial</button></div></footer></div>`;

        const closePreview = () => {
            viewer.remove();
            window.removeEventListener("resize", updateZoom);
        };
        const updateZoom = () => {
            const pageArea = viewer.querySelector(".proposal-pdf-preview__page");
            const image = viewer.querySelector("[data-pdf-preview-image]");
            const usableHeight = Math.max(pageArea.clientHeight - 36, 1);
            pageArea.classList.toggle("is-zoomed", zoom > 1);
            image.style.setProperty("height", `${Math.round(usableHeight * zoom)}px`, "important");
            viewer.querySelector("[data-pdf-preview-zoom-value]").textContent = `${Math.round(zoom * 100)}%`;
            viewer.querySelector('[data-pdf-preview-zoom="out"]').disabled = zoom <= 1;
            viewer.querySelector('[data-pdf-preview-zoom="in"]').disabled = zoom >= 2.25;
        };

        const renderPage = () => {
            const page = payload.pages[currentPage];
            viewer.querySelector("[data-pdf-preview-image]").src = page.image;
            viewer.querySelector("[data-pdf-preview-position]").textContent = `Página ${page.number} de ${payload.pages.length}`;
            viewer.querySelector('[data-pdf-preview-page="previous"]').disabled = currentPage === 0;
            viewer.querySelector('[data-pdf-preview-page="next"]').disabled = currentPage === payload.pages.length - 1;
            window.requestAnimationFrame(updateZoom);
        };
        viewer.addEventListener("click", async (event) => {
            if (event.target === viewer || event.target.closest("[data-pdf-preview-close]")) {
                closePreview();
                return;
            }
            const direction = event.target.closest("[data-pdf-preview-page]")?.dataset.pdfPreviewPage;
            if (direction) {
                currentPage = direction === "next" ? Math.min(currentPage + 1, payload.pages.length - 1) : Math.max(currentPage - 1, 0);
                renderPage();
                return;
            }
            const zoomAction = event.target.closest("[data-pdf-preview-zoom]")?.dataset.pdfPreviewZoom;
            if (zoomAction) {
                zoom = Math.min(2.25, Math.max(1, zoom + (zoomAction === "in" ? 0.25 : -0.25)));
                updateZoom();
                return;
            }
            if (event.target.closest("[data-pdf-preview-generate]")) {
                const button = event.target.closest("[data-pdf-preview-generate]");
                button.disabled = true;
                button.textContent = "Gerando PDF...";
                await downloadProposalPdf(finalEndpoint, filename, "Proposta");
                button.disabled = false;
                button.textContent = "Gerar PDF oficial";
            }
        });
        document.body.appendChild(viewer);
        window.addEventListener("resize", updateZoom);
        renderPage();
        } finally {
            loading.remove();
        }
    }

    async function downloadProposalPdf(endpoint, filename, label = "Proposta") {
        try {
            const response = await fetch(endpoint, {
                credentials: "same-origin",
                headers: { "X-Requested-With": "XMLHttpRequest" }
            });

            if (!response.ok) {
                const rawMessage = await response.text();
                let message = rawMessage;
                try {
                    const payload = JSON.parse(rawMessage);
                    message = payload.message || payload.error || rawMessage;
                } catch (_) {
                    // Respostas legadas podem não ser JSON; preservamos a mensagem recebida.
                }
                throw new Error(message || "Não foi possível gerar o PDF da proposta.");
            }

            const contentType = response.headers.get("content-type") || "";
            if (!contentType.includes("application/pdf")) {
                const message = await response.text();
                throw new Error(message || "O servidor n\u00e3o retornou um arquivo PDF v\u00e1lido.");
            }

            const contentDisposition = response.headers.get("content-disposition") || "";
            const serverFilename = contentDisposition.match(/filename\*?=(?:UTF-8''|\")?([^;\"]+)/i)?.[1];
            const pdfBlob = await response.blob();
            const downloadUrl = URL.createObjectURL(pdfBlob);
            const downloadLink = document.createElement("a");
            downloadLink.href = downloadUrl;
            downloadLink.download = decodeURIComponent(serverFilename || filename || "proposta.pdf").replace(/[\"']/g, "");
            document.body.appendChild(downloadLink);
            downloadLink.click();
            downloadLink.remove();
            // Alguns navegadores iniciam o download de forma ass\u00edncrona; revogar agora pode cancel\u00e1-lo.
            window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

            showNotification({
                type: "success",
                title: "PDF gerado",
                message: `O PDF ${label.toLowerCase()} foi baixado com sucesso.`
            });
        } catch (error) {
            showNotification({
                type: "warning",
                title: "Erro ao gerar PDF",
                message: error.message || "Não foi possível gerar o PDF da proposta."
            });
        }
    }

    async function handleProposalPdfRequest(trigger) {
        const label = trigger.dataset.pdfLabel || "Proposta";
        if (label !== "Proposta") {
            downloadProposalPdf(trigger.href, trigger.download, label);
            return;
        }
        const proposalId = Number(trigger.href.match(/propostas\/(\d+)\/pdf\//)?.[1]);
        if (!proposalId || !state.endpoints.documentReviewPattern) {
            showNotification({
                type: "warning",
                title: "Revisão indisponível",
                message: "Não foi possível iniciar a revisão documental desta proposta.",
            });
            return;
        }
        try {
            const endpoint = buildEndpoint(state.endpoints.documentReviewPattern, proposalId);
            const payload = await fetchJson(endpoint);
            if (payload?.document_selection_required) {
                openOnshoreDocumentSelector(payload, proposalId, trigger.href, trigger.download);
                return;
            }
            openDocumentReviewModal(payload, proposalId, trigger.href, trigger.download);
        } catch (error) {
            showNotification({ type: "warning", title: "Revisão indisponível", message: error.message || "Não foi possível abrir a revisão documental." });
        }
    }

    function openOnshoreDocumentSelector(payload, proposalId, pdfEndpoint, filename) {
        const modal = document.createElement("section");
        modal.className = "document-type-selector document-type-selector--quick";
        modal.innerHTML = `<div class="document-type-selector__dialog" role="dialog" aria-modal="true" aria-label="Selecionar documento da proposta"><p>Qual documento deseja revisar?</p><div class="document-type-selector__choices">${(payload.document_types || []).map((documentType) => `<button class="document-type-selector__choice" type="button" data-onshore-document-type="${escapeHtml(documentType.value)}" aria-label="Revisar ${escapeHtml(documentType.label)}"><span class="material-icons" aria-hidden="true">${documentType.value === "PC_ONSHORE" ? "description" : "assignment"}</span><strong>${escapeHtml(documentType.label)}</strong></button>`).join("")}</div></div>`;
        document.body.appendChild(modal);
        document.body.classList.add("comercial-proposal-modal-open", "comercial-no-scroll");
        const close = () => {
            modal.remove();
            document.body.classList.remove("comercial-proposal-modal-open", "comercial-no-scroll");
        };
        modal.addEventListener("click", async (event) => {
            if (event.target === modal) {
                close();
                return;
            }
            const button = event.target.closest("[data-onshore-document-type]");
            if (!button) return;
            const type = button.dataset.onshoreDocumentType;
            button.disabled = true;
            try {
                const reviewEndpoint = `${buildEndpoint(state.endpoints.documentReviewPattern, proposalId)}?document_type=${encodeURIComponent(type)}`;
                const reviewPayload = await fetchJson(reviewEndpoint);
                close();
                openDocumentReviewModal(reviewPayload, proposalId, `${pdfEndpoint}?document_type=${encodeURIComponent(type)}`, filename, type);
            } catch (error) {
                button.disabled = false;
                showNotification({
                    type: "warning",
                    title: "Revisão indisponível",
                    message: error.message || "Não foi possível carregar a revisão documental selecionada.",
                });
            }
        });
    }

    function openOnshorePcReviewModal(payload, proposalId, pdfEndpoint, filename) {
        const review = payload.revisao || {};
        const content = review.conteudo || {};
        const modal = document.createElement("section");
        modal.className = "document-review-modal document-review-modal--onshore-pc";
        document.body.classList.add("comercial-proposal-modal-open", "comercial-no-scroll");
        modal.innerHTML = `<div class="document-review-modal__dialog"><header><div><h2>Revisar Proposta Comercial Onshore</h2><p>Proposta ${escapeHtml(payload.proposta.numeroProposta)} • REV ${escapeHtml(review.revisaoDocumental || "00")} • Onshore</p></div><button type="button" data-document-close>×</button></header><main><section class="document-review__general"><h3>Dados gerais <small>Automático</small></h3><div class="document-review__readonly-grid"><span><b>Cliente</b>${escapeHtml(payload.proposta.empresa)}</span><span><b>Serviço</b>${escapeHtml(payload.proposta.servico || payload.proposta.escopo)}</span><span><b>Solicitante</b>${escapeHtml(payload.proposta.solicitante || "Não informado")}</span><span><b>E-mail</b>${escapeHtml(payload.proposta.emailSolicitante || "Não informado")}</span></div></section><section class="document-review__section"><h3>Carta / serviço <small>Revisão documental</small></h3><label>Complemento do serviço<textarea data-pc-service-complement placeholder="Use somente se o serviço exigir complemento na carta.">${escapeHtml(content.complemento_servico || "")}</textarea></label></section><section class="document-review__section"><h3>Referência à Proposta Técnica <small>Revisão documental</small></h3><label class="document-review__checkbox"><input type="checkbox" data-pc-has-pt ${content.possui_pt ? "checked" : ""}> Esta PC possui uma Proposta Técnica relacionada</label><div data-pc-pt-fields class="document-review__line-fields ${content.possui_pt ? "" : "is-hidden"}"><label>Identificação da PT<input data-pc-pt-id value="${escapeHtml(content.pt_identificacao || "")}"></label><label>Data da PT<input type="date" data-pc-pt-date value="${escapeHtml(content.pt_data || "")}"></label><label>REV da PT<input data-pc-pt-revision value="${escapeHtml(content.pt_revisao || "")}"></label></div><label>Texto de introdução sem PT<textarea data-pc-no-pt-text placeholder="Obrigatório somente se não houver PT relacionada.">${escapeHtml(content.introducao_sem_pt || "")}</textarea></label></section><section class="document-review__section"><h3>Proposta financeira <small>Automático a partir da proposta</small></h3><div class="document-review__financial">${(review.financeiro || []).map((item) => `<div><b>${escapeHtml(item.descricao)}</b><span>Qtd. ${escapeHtml(item.quantidade)}</span><strong>R$ ${escapeHtml(item.preco_unitario)}</strong></div>`).join("") || "Nenhum item financeiro cadastrado."}</div></section><section class="document-review__section"><h3>Prazo e validade <small>Revisão documental</small></h3><div class="document-review__line-fields"><label>Prazo de execução<input data-pc-deadline value="${escapeHtml(content.prazo || "")}" placeholder="Ex.: ${escapeHtml(payload.proposta.tempoContratoDias || "60 dias")}"></label><label>Validade em dias<input type="number" min="1" data-pc-validity value="${escapeHtml(content.validade_dias || "")}" placeholder="Ex.: 30"></label></div><label>Texto complementar<textarea data-pc-deadline-note placeholder="Ex.: Mobilização a combinar, após assinatura de contrato.">${escapeHtml(content.prazo_complementar || "")}</textarea></label></section><section class="document-review__section"><h3>Revisão final</h3><p>Os campos comerciais são preenchidos automaticamente; confirme os campos documentais antes da pré-visualização.</p></section></main><footer><button type="button" data-document-close>Cancelar</button><button type="button" data-document-save>Salvar rascunho</button><button type="button" data-document-preview>Pré-visualizar PDF</button></footer></div>`;
        document.body.appendChild(modal);
        const clearLegacyDefault = (selector, expectedValue, placeholder) => {
            const input = modal.querySelector(selector);
            if (input && String(input.value || "").trim() === String(expectedValue || "").trim()) {
                input.value = "";
                input.placeholder = placeholder;
            }
        };
        const pcDeadlineInput = modal.querySelector("[data-pc-deadline]");
        const proposalDeadlineNumber = String(payload.proposta.tempoContratoDias || "").match(/\d+/)?.[0] || "";
        const reviewDeadlineNumber = String(pcDeadlineInput?.value || "").match(/\d+/)?.[0] || "";
        if (pcDeadlineInput && (!content.prazo || (proposalDeadlineNumber && reviewDeadlineNumber === proposalDeadlineNumber))) {
            pcDeadlineInput.value = "";
            pcDeadlineInput.placeholder = `Ex.: ${payload.proposta.tempoContratoDias || "60 dias"}`;
        }
        clearLegacyDefault("[data-pc-validity]", "30", "Ex.: 30");
        clearLegacyDefault("[data-pc-deadline-note]", "Mobilização a combinar, após assinatura de contrato.", "Ex.: Mobilização a combinar, após assinatura de contrato.");
        const automaticTechnicalReference = [
            payload.proposta.numeroProposta,
            payload.proposta.empresa,
            payload.proposta.servico || payload.proposta.escopo,
            payload.proposta.unidade,
        ].filter(Boolean).join(" - ");
        const legacyLetterSection = [...modal.querySelectorAll(".document-review__section")].find((section) => section.querySelector("h3")?.textContent.includes("Carta / serviço"));
        if (legacyLetterSection) {
            legacyLetterSection.outerHTML = `<section class="document-review__section document-review__technical-reference"><h3>Referência à Proposta Técnica <small>Dados para a introdução</small></h3><p class="document-review__notice">A identificação é formada automaticamente a partir dos dados comerciais da proposta.</p><div class="document-review__generated-reference"><span>Nº da proposta - Cliente - Serviço - Unidade</span><strong>${escapeHtml(automaticTechnicalReference || "Dados da proposta não informados")}</strong></div><label>Data da Proposta Técnica<input type="date" data-pc-pt-date value="${escapeHtml(content.pt_data || "")}" required></label></section>`;
        }
        const legacyTechnicalReference = [...modal.querySelectorAll(".document-review__section")].find((section) => section.querySelector("h3")?.textContent.startsWith("Referência à Proposta Técnica") && !section.classList.contains("document-review__technical-reference"));
        legacyTechnicalReference?.remove();
        const financialSection = [...modal.querySelectorAll(".document-review__section")].find((section) => section.querySelector("h3")?.textContent.includes("Proposta financeira"));
        if (financialSection) {
            const selectedItems = content.itens_financeiros || {};
            const asIntegerQuantity = (value) => Math.max(1, Math.round(Number(String(value || "1").replace(",", ".")) || 1));
            financialSection.insertAdjacentHTML("afterbegin", `<div class="document-review__line-fields document-review__financial-meta"><label>Escopo do PPU<textarea data-pc-financial-scope placeholder="Descreva o escopo que será exibido na planilha de preços.">${escapeHtml(content.escopo_ppu || "")}</textarea></label><label>Prazo do PPU<input data-pc-financial-deadline value="${escapeHtml(content.prazo_ppu || "")}" placeholder="Ex.: ${escapeHtml(content.prazo || payload.proposta.tempoContratoDias || "48 horas")}"></label></div><p class="document-review__notice">Cliente e ID são preenchidos pela proposta. A quantidade aceita somente números inteiros e também atualiza o item comercial.</p><div class="document-review__financial-select">${(review.financeiro || []).map((item, index) => { const selected = selectedItems[item.id] || selectedItems[String(index)] || {}; return `<label><input type="checkbox" data-pc-financial-item data-item-key="${escapeHtml(String(item.id || index))}" ${selected.incluir !== false ? "checked" : ""}><span>${escapeHtml(item.descricao)}</span><input type="number" min="1" step="1" inputmode="numeric" data-pc-financial-quantity value="${escapeHtml(String(asIntegerQuantity(selected.quantidade || item.quantidade || 1)))}" aria-label="Quantidade de ${escapeHtml(item.descricao)}"></label>`; }).join("")}</div>`);
        }
        const resizeReviewTextarea = (textarea) => {
            textarea.style.height = "42px";
            textarea.style.height = `${Math.max(42, textarea.scrollHeight)}px`;
        };
        modal.querySelectorAll("textarea").forEach(resizeReviewTextarea);
        const close = () => { modal.remove(); document.body.classList.remove("comercial-proposal-modal-open", "comercial-no-scroll"); };
        const save = async (notify = true) => {
            const itensFinanceiros = {};
            modal.querySelectorAll("[data-pc-financial-item]").forEach((checkbox, index) => { itensFinanceiros[checkbox.dataset.itemKey || index] = { incluir: checkbox.checked, quantidade: checkbox.closest("label").querySelector("[data-pc-financial-quantity]").value }; });
            const conteudo = { possui_pt: true, pt_data: modal.querySelector("[data-pc-pt-date]").value, prazo: modal.querySelector("[data-pc-deadline]").value.trim(), validade_dias: modal.querySelector("[data-pc-validity]").value, prazo_complementar: modal.querySelector("[data-pc-deadline-note]").value.trim(), escopo_ppu: modal.querySelector("[data-pc-financial-scope]").value.trim(), prazo_ppu: modal.querySelector("[data-pc-financial-deadline]").value.trim(), itens_financeiros: itensFinanceiros };
            const response = await fetchJson(buildEndpoint(state.endpoints.documentReviewSavePattern, proposalId), { method: "POST", body: JSON.stringify({ document_type: "PC_ONSHORE", conteudo }) });
            if (notify) showNotification({ type: "success", title: "Rascunho salvo", message: "A revisão da Proposta Comercial Onshore foi salva." });
            return response;
        };
        modal.addEventListener("change", (event) => {
            if (!event.target.matches("[data-pc-financial-quantity]")) return;
            const quantity = Number(event.target.value);
            event.target.value = String(Number.isInteger(quantity) && quantity > 0 ? quantity : 1);
        });
        modal.addEventListener("input", (event) => {
            if (event.target.matches("textarea")) resizeReviewTextarea(event.target);
        });
        const documentModeUrl = (mode, asImages = false) => `${pdfEndpoint}${pdfEndpoint.includes("?") ? "&" : "?"}document_mode=${mode}${asImages ? "&preview_format=images" : ""}`;
        modal.addEventListener("click", async (event) => { if (event.target.closest("[data-document-close]")) return close(); if (event.target.closest("[data-document-save]")) { try { await save(); } catch (error) { showNotification({ type: "warning", title: "Não foi possível salvar", message: error.message }); } } if (event.target.closest("[data-document-preview]")) { try { await save(false); await previewProposalPdf(documentModeUrl("preview", true), documentModeUrl("final"), filename); } catch (error) { showNotification({ type: "warning", title: "Pré-visualização indisponível", message: error.message }); } } });
    }

    function openOnshorePtReviewModal(payload, proposalId, pdfEndpoint, filename) {
        const review = payload.revisao || {};
        const content = review.conteudo || {};
        const modal = document.createElement("section");
        modal.className = "document-review-modal document-review-modal--onshore-pt";
        document.body.classList.add("comercial-proposal-modal-open", "comercial-no-scroll");
        const references = Array.isArray(content.referencias) ? content.referencias : [];
        const histogramRows = Array.isArray(content.histograma_mao_obra) ? content.histograma_mao_obra : [];
        const equipmentHistogramRows = Array.isArray(content.histograma_equipamentos) ? content.histograma_equipamentos : [];
        const currentRevision = Math.max(0, Number(payload.proposta.rev || 0));
        const revisionRows = Array.isArray(content.quadro_revisoes) && content.quadro_revisoes.length
            ? content.quadro_revisoes
            : [{ revisao: String(currentRevision).padStart(2, "0"), data: content.data_emissao || "", descricao: currentRevision === 0 ? "Emissão Inicial." : "" }];
        const renderReference = (value = "") => `<div class="document-review__line"><input data-pt-reference value="${escapeHtml(value)}" placeholder="Documento, e-mail ou referência do cliente"><button type="button" data-pt-reference-remove>Remover</button></div>`;
        const renderHistogramRow = (row = {}) => `<div class="document-review__line document-review__histogram-line"><input data-pt-histogram-function value="${escapeHtml(row.funcao || "")}" placeholder="Função"><input type="number" min="1" step="1" inputmode="numeric" data-pt-histogram-quantity value="${escapeHtml(row.quantidade || "")}" placeholder="Qtd."><button type="button" data-pt-histogram-remove>Remover</button></div>`;
        const renderEquipmentHistogramRow = (description = "") => `<div class="document-review__line document-review__equipment-histogram-line"><input data-pt-equipment-description value="${escapeHtml(description)}" placeholder="Descrição do equipamento"><button type="button" data-pt-equipment-remove>Remover</button></div>`;
        const revisionSection = currentRevision > 0
            ? `<section class="document-review__section document-review__revision-board"><h3>Quadro de revisões</h3><table><thead><tr><th>Revisão</th><th>Data</th><th>Descrição</th></tr></thead><tbody>${revisionRows.map((row) => `<tr><td>${escapeHtml(row.revisao)}</td><td>${escapeHtml(row.data || "-")}</td><td>${escapeHtml(row.descricao || "-")}</td></tr>`).join("")}</tbody></table><div class="document-review__line-fields"><label>REV<input value="${String(currentRevision).padStart(2, "0")}" readonly></label><label>Data da revisão<input type="date" data-pt-revision-date value="${escapeHtml(content.data_revisao || "")}"></label><label>Descrição da revisão<input data-pt-revision-description value="${escapeHtml(content.descricao_revisao || "")}" placeholder="Descreva a alteração desta revisão"></label></div></section>`
            : `<section class="document-review__section document-review__revision-board"><h3>Quadro de revisões</h3><table><thead><tr><th>Revisão</th><th>Data</th><th>Descrição</th></tr></thead><tbody>${revisionRows.map((row) => `<tr><td>${escapeHtml(row.revisao)}</td><td>${escapeHtml(row.data || "-")}</td><td>${escapeHtml(row.descricao || "Emissão Inicial.")}</td></tr>`).join("")}</tbody></table></section>`;
        modal.innerHTML = `<div class="document-review-modal__dialog"><header><div><h2>Revisar Proposta Técnica Onshore</h2><p>Proposta ${escapeHtml(payload.proposta.numeroProposta)} • REV ${escapeHtml(payload.proposta.rev || "00")} • Onshore</p></div><button type="button" data-document-close>×</button></header><main><section class="document-review__general"><h3>Dados automáticos <small>Origem: proposta comercial</small></h3><div class="document-review__readonly-grid"><span><b>Número da proposta</b>${escapeHtml(payload.proposta.numeroProposta || "Não informado")}</span><span><b>Serviço</b>${escapeHtml(payload.proposta.servico || payload.proposta.escopo || "Não informado")}</span><span><b>Cliente</b>${escapeHtml(payload.proposta.empresa || "Não informado")}</span><span><b>Solicitante</b>${escapeHtml(payload.proposta.solicitante || "Não informado")}</span><span><b>E-mail</b>${escapeHtml(payload.proposta.emailSolicitante || "Não informado")}</span></div></section>${revisionSection}<section class="document-review__section"><h3>Resumo sobre a planta do cliente</h3><label><textarea data-pt-summary placeholder="Descreva resumidamente a planta do cliente.">${escapeHtml(content.resumo_planta || "")}</textarea></label></section><section class="document-review__section"><h3>Referências</h3><label class="document-review__checkbox"><input type="checkbox" data-pt-no-references ${content.sem_referencias ? "checked" : ""}> Não existem referências específicas</label><div class="document-review__lines" data-pt-reference-lines>${(references.length ? references : [""]).map(renderReference).join("")}</div><button type="button" data-pt-reference-add>+ Adicionar referência</button></section><section class="document-review__section"><h3>Histograma de mão de obra</h3><p class="document-review__notice">Informe a função e a quantidade inteira de cada profissional.</p><div class="document-review__lines" data-pt-histogram-lines>${(histogramRows.length ? histogramRows : [{}]).map(renderHistogramRow).join("")}</div><button type="button" data-pt-histogram-add>+ Adicionar função</button></section><section class="document-review__section"><h3>Histograma de equipamentos</h3><p class="document-review__notice">Informe a descrição de cada equipamento que deve constar no histograma.</p><div class="document-review__lines" data-pt-equipment-histogram-lines>${(equipmentHistogramRows.length ? equipmentHistogramRows : [""]).map(renderEquipmentHistogramRow).join("")}</div><button type="button" data-pt-equipment-add>+ Adicionar equipamento</button></section><section class="document-review__section"><h3>Prazo e jornada</h3><div class="document-review__line-fields"><label>Prazo de execução<input data-pt-deadline value="${escapeHtml(content.prazo_execucao || "")}" placeholder="Ex.: 30 dias"></label><label>Jornada<input data-pt-journey value="${escapeHtml(content.jornada || "07:00 às 17:00.")}" placeholder="Ex.: 07:00 às 17:00."></label><label>Data de emissão<input type="date" data-pt-emission-date value="${escapeHtml(content.data_emissao || "")}"></label></div></section><section class="document-review__section"><h3>Conferência documental</h3><p class="document-review__notice">A revisão mostra somente os conteúdos variáveis destacados no documento oficial. Os demais textos e elementos permanecem inalterados.</p></section></main><footer><button type="button" data-document-close>Cancelar</button><button type="button" data-document-save>Salvar rascunho</button><button type="button" data-document-preview>Pré-visualizar PDF</button></footer></div>`;
        document.body.appendChild(modal);

        const clearPtLegacyDefault = (selector, expectedValue, placeholder) => {
            const input = modal.querySelector(selector);
            if (input && String(input.value || "").trim() === String(expectedValue || "").trim()) {
                input.value = "";
                input.placeholder = placeholder;
            }
        };
        const ptDeadlineInput = modal.querySelector("[data-pt-deadline]");
        const proposalDeadlineNumber = String(payload.proposta.tempoContratoDias || "").match(/\d+/)?.[0] || "";
        const reviewDeadlineNumber = String(ptDeadlineInput?.value || "").match(/\d+/)?.[0] || "";
        if (ptDeadlineInput && (!content.prazo_execucao || (proposalDeadlineNumber && reviewDeadlineNumber === proposalDeadlineNumber))) {
            ptDeadlineInput.value = "";
            ptDeadlineInput.placeholder = `Ex.: ${payload.proposta.tempoContratoDias || "30 dias"}`;
        }
        clearPtLegacyDefault("[data-pt-journey]", "07:00 às 17:00.", "Ex.: 07:00 às 17:00.");
        clearPtLegacyDefault("[data-pt-journey]", "07:00 as 17:00.", "Ex.: 07:00 às 17:00.");
        clearPtLegacyDefault("[data-pt-emission-date]", payload.proposta.emissao, "Selecione a data de emissão");

        // The official PT places these fields in separate chapters. Keep the
        // same inputs, but present them in the review in document order.
        const scheduleSection = [...modal.querySelectorAll(".document-review__section")]
            .find((section) => section.querySelector("h3")?.textContent.trim().toLowerCase() === "prazo e jornada");
        if (scheduleSection) {
            const fields = scheduleSection.querySelectorAll(".document-review__line-fields > label");
            const createFieldSection = (title, field) => {
                const section = document.createElement("section");
                section.className = "document-review__section document-review__section--pt-schedule";
                section.innerHTML = `<h3>${title}</h3><div class="document-review__line-fields"></div>`;
                section.querySelector(".document-review__line-fields").appendChild(field);
                return section;
            };
            const referencesSection = [...modal.querySelectorAll(".document-review__section")]
                .find((section) => section.querySelector("h3")?.textContent.trim().toLowerCase() === "referências");
            const equipmentSection = modal.querySelector("[data-pt-equipment-histogram-lines]")?.closest(".document-review__section");
            const conferenceSection = [...modal.querySelectorAll(".document-review__section")]
                .find((section) => section.querySelector("h3")?.textContent.trim().toLowerCase() === "conferência documental");

            if (fields[0] && referencesSection) referencesSection.after(createFieldSection("Prazo de execução", fields[0]));
            if (fields[1] && equipmentSection) equipmentSection.after(createFieldSection("Jornada de trabalho", fields[1]));
            if (fields[2] && conferenceSection) conferenceSection.before(createFieldSection("Data de emissão", fields[2]));
            scheduleSection.remove();
        }

        const noReferencesControl = modal.querySelector("[data-pt-no-references]")?.closest(".document-review__checkbox");
        const addReferenceButton = modal.querySelector("[data-pt-reference-add]");
        if (noReferencesControl && addReferenceButton) {
            noReferencesControl.classList.add("document-review__checkbox--pt-references");
            addReferenceButton.after(noReferencesControl);
        }

        const deadlineSection = modal.querySelector("[data-pt-deadline]")?.closest(".document-review__section");
        const laborHistogramSection = modal.querySelector("[data-pt-histogram-lines]")?.closest(".document-review__section");
        let methodologySection;
        if (deadlineSection && laborHistogramSection) {
            methodologySection = document.createElement("section");
            methodologySection.className = "document-review__section document-review__section--pt-methodology";
            methodologySection.innerHTML = `<h3>Metodologia executiva</h3><p class="document-review__notice">Descreva a metodologia somente quando for necessária para a proposta técnica.</p><label><textarea data-pt-methodology placeholder="Descreva a metodologia executiva.">${escapeHtml(content.metodologia_executiva || "")}</textarea></label>`;
            deadlineSection.after(methodologySection);
        }
        if (methodologySection && laborHistogramSection) {
            const histogramDescriptionSection = document.createElement("section");
            histogramDescriptionSection.className = "document-review__section document-review__section--pt-histogram-description";
            histogramDescriptionSection.innerHTML = `<h3>Histograma</h3><p class="document-review__notice">Adicione uma observação para o capítulo de histograma, caso necessário.</p><label><textarea data-pt-histogram-description placeholder="Descreva o histograma, se necessário.">${escapeHtml(content.descricao_histograma || "")}</textarea></label>`;
            methodologySection.after(histogramDescriptionSection);
        }

        const close = () => {
            modal.remove();
            document.body.classList.remove("comercial-proposal-modal-open", "comercial-no-scroll");
        };
        const save = async (notify = true) => {
            const conteudo = {
                resumo_planta: modal.querySelector("[data-pt-summary]").value.trim(),
                metodologia_executiva: modal.querySelector("[data-pt-methodology]").value.trim(),
                descricao_histograma: modal.querySelector("[data-pt-histogram-description]").value.trim(),
                referencias: [...modal.querySelectorAll("[data-pt-reference]")].map((input) => input.value.trim()).filter(Boolean),
                sem_referencias: modal.querySelector("[data-pt-no-references]").checked,
                prazo_execucao: modal.querySelector("[data-pt-deadline]").value.trim(),
                jornada: modal.querySelector("[data-pt-journey]").value.trim(),
                data_emissao: modal.querySelector("[data-pt-emission-date]").value,
                data_revisao: modal.querySelector("[data-pt-revision-date]")?.value || "",
                descricao_revisao: modal.querySelector("[data-pt-revision-description]")?.value.trim() || "",
                histograma_mao_obra: [...modal.querySelectorAll(".document-review__histogram-line")].map((row) => ({
                    funcao: row.querySelector("[data-pt-histogram-function]").value.trim(),
                    quantidade: row.querySelector("[data-pt-histogram-quantity]").value.trim(),
                })),
                histograma_equipamentos: [...modal.querySelectorAll(".document-review__equipment-histogram-line")]
                    .map((row) => row.querySelector("[data-pt-equipment-description]").value.trim())
                    .filter(Boolean),
            };
            const response = await fetchJson(buildEndpoint(state.endpoints.documentReviewSavePattern, proposalId), {
                method: "POST",
                body: JSON.stringify({ document_type: "PT_ONSHORE", conteudo }),
            });
            if (notify) showNotification({ type: "success", title: "Rascunho salvo", message: "A revisão da Proposta Técnica Onshore foi salva." });
            return response;
        };
        const updateReferenceState = () => {
            const disabled = modal.querySelector("[data-pt-no-references]").checked;
            modal.querySelectorAll("[data-pt-reference]").forEach((input) => { input.disabled = disabled; });
            modal.querySelector("[data-pt-reference-add]").disabled = disabled;
        };
        const validateForPreview = () => {
            const summary = modal.querySelector("[data-pt-summary]").value.trim();
            const deadline = modal.querySelector("[data-pt-deadline]").value.trim();
            const journey = modal.querySelector("[data-pt-journey]").value.trim();
            const emissionDate = modal.querySelector("[data-pt-emission-date]").value;
            const hasReferences = [...modal.querySelectorAll("[data-pt-reference]")].some((input) => input.value.trim());
            const noReferences = modal.querySelector("[data-pt-no-references]").checked;
            const revisionDate = modal.querySelector("[data-pt-revision-date]")?.value || "";
            const revisionDescription = modal.querySelector("[data-pt-revision-description]")?.value.trim() || "";
            const invalidHistogram = [...modal.querySelectorAll(".document-review__histogram-line")].some((row) => {
                const functionName = row.querySelector("[data-pt-histogram-function]").value.trim();
                const quantity = row.querySelector("[data-pt-histogram-quantity]").value.trim();
                return Boolean(functionName || quantity) && (!functionName || !/^\d+$/.test(quantity) || Number(quantity) < 1);
            });
            if (!summary || !deadline || !journey || !emissionDate || (!hasReferences && !noReferences) || (hasReferences && noReferences) || invalidHistogram || (currentRevision > 0 && (!revisionDate || !revisionDescription))) {
                showNotification({
                    type: "warning",
                    title: "Revise os campos destacados",
                    message: invalidHistogram ? "Cada linha do histograma deve ter função e quantidade inteira maior que zero." : currentRevision > 0 ? "Preencha os campos da revisão, inclusive data e descrição da REV atual." : "Preencha resumo, prazo, jornada e data. Informe referências ou marque que não existem referências específicas.",
                });
                return false;
            }
            return true;
        };
        updateReferenceState();
        modal.addEventListener("change", (event) => {
            if (event.target.matches("[data-pt-no-references]")) updateReferenceState();
            if (event.target.matches("[data-pt-histogram-quantity]") && event.target.value) {
                const value = Number(event.target.value);
                event.target.value = Number.isInteger(value) && value > 0 ? String(value) : "";
            }
        });
        modal.addEventListener("click", async (event) => {
            if (event.target.closest("[data-document-close]")) return close();
            if (event.target.closest("[data-pt-reference-add]")) {
                modal.querySelector("[data-pt-reference-lines]").insertAdjacentHTML("beforeend", renderReference());
                return;
            }
            if (event.target.closest("[data-pt-reference-remove]")) {
                const row = event.target.closest(".document-review__line");
                const rows = modal.querySelectorAll("[data-pt-reference-lines] .document-review__line");
                if (rows.length === 1) row.querySelector("[data-pt-reference]").value = "";
                else row.remove();
                return;
            }
            if (event.target.closest("[data-pt-histogram-add]")) {
                modal.querySelector("[data-pt-histogram-lines]").insertAdjacentHTML("beforeend", renderHistogramRow());
                return;
            }
            if (event.target.closest("[data-pt-histogram-remove]")) {
                const row = event.target.closest(".document-review__histogram-line");
                const rows = modal.querySelectorAll("[data-pt-histogram-lines] .document-review__histogram-line");
                if (rows.length === 1) {
                    row.querySelector("[data-pt-histogram-function]").value = "";
                    row.querySelector("[data-pt-histogram-quantity]").value = "";
                } else row.remove();
                return;
            }
            if (event.target.closest("[data-pt-equipment-add]")) {
                modal.querySelector("[data-pt-equipment-histogram-lines]").insertAdjacentHTML("beforeend", renderEquipmentHistogramRow());
                return;
            }
            if (event.target.closest("[data-pt-equipment-remove]")) {
                const row = event.target.closest(".document-review__equipment-histogram-line");
                const rows = modal.querySelectorAll("[data-pt-equipment-histogram-lines] .document-review__equipment-histogram-line");
                if (rows.length === 1) row.querySelector("[data-pt-equipment-description]").value = "";
                else row.remove();
                return;
            }
            if (event.target.closest("[data-document-save]")) {
                try { await save(); } catch (error) { showNotification({ type: "warning", title: "Não foi possível salvar", message: error.message }); }
                return;
            }
            if (event.target.closest("[data-document-preview]")) {
                try {
                    if (!validateForPreview()) return;
                    await save(false);
                    const separator = pdfEndpoint.includes("?") ? "&" : "?";
                    await previewProposalPdf(`${pdfEndpoint}${separator}document_mode=preview&preview_format=images`, `${pdfEndpoint}${separator}document_mode=final`, filename);
                } catch (error) {
                    showNotification({ type: "warning", title: "Pré-visualização indisponível", message: error.message || "Revise os campos destacados antes de gerar a prévia." });
                }
            }
        });
    }

    function openDocumentReviewModal(payload, proposalId, pdfEndpoint, filename, documentType = "PC_OFFSHORE") {
        if (documentType === "PC_ONSHORE") {
            openOnshorePcReviewModal(payload, proposalId, pdfEndpoint, filename);
            return;
        }
        if (documentType === "PT_ONSHORE") {
            openOnshorePtReviewModal(payload, proposalId, pdfEndpoint, filename);
            return;
        }
        const review = payload.revisao;
        const lines = review.linhas || {};
        const renderLines = (kind, label, quantity = false) => `
            <section class="document-review__section document-review__section--offshore-content" data-document-kind="${kind}"><h3>${label}</h3>
            <div class="document-review__lines">${(lines[kind] || []).map((line) => `<div class="document-review__line"><input value="${escapeHtml(line.descricao)}" placeholder="Descreva o conteúdo"><input class="document-review__quantity ${quantity ? "" : "is-hidden"}" value="${escapeHtml(line.quantidade || "")}" placeholder="${quantity ? "Qtd./POB" : ""}"><button type="button" data-document-remove>Remover</button></div>`).join("")}</div>
            <div class="document-review__section-actions"><button type="button" data-document-add>+ Adicionar linha</button></div><label class="document-review__checkbox document-review__checkbox--offshore"><input type="checkbox" data-document-confirm ${review.confirmacoes?.[kind.toLowerCase().replace("PROCEDIMENTO", "procedimento").replace("EQUIPE", "equipe").replace("EQUIPAMENTO", "equipamentos").replace("PREMISSA", "premissas").replace("OBRIGACAO", "obrigacoes")] ? "checked" : ""}><span><strong>Conteúdo revisado</strong><small>Confirmo que as informações desta seção estão corretas.</small></span></label></section>`;
        const modal = document.createElement("section");
        modal.className = "document-review-modal document-review-modal--offshore";
        document.body.classList.add("comercial-proposal-modal-open", "comercial-no-scroll");
        const isOnshore = documentType !== "PC_OFFSHORE";
        const reviewTitle = documentType === "PT_ONSHORE" ? "Revisar Proposta Técnica Onshore" : isOnshore ? "Revisar Proposta Comercial Onshore" : "Revisar Proposta Comercial";
        const operationLabel = isOnshore ? "Onshore" : "Offshore";
        const documentRevision = review.revisaoDocumental || payload.proposta.rev || "00";
        modal.innerHTML = `<div class="document-review-modal__dialog"><header><div><h2>${reviewTitle}</h2><p>Proposta ${escapeHtml(payload.proposta.numeroProposta)} • REV ${escapeHtml(documentRevision)} • ${operationLabel}</p></div><button type="button" data-document-close>×</button></header><main><section class="document-review__general"><h3>Dados gerais</h3><p><strong>Cliente:</strong> ${escapeHtml(payload.proposta.empresa)} &nbsp; <strong>Unidade:</strong> ${escapeHtml(payload.proposta.unidade)} &nbsp; <strong>Serviço:</strong> ${escapeHtml(payload.proposta.escopo || payload.proposta.servico)}</p></section><p class="document-review__notice">Conteúdo carregado do modelo oficial. Revise e confirme cada seção antes da emissão.</p><label>Introdução e objetivo<textarea data-document-introduction>${escapeHtml(review.introducao || "")}</textarea></label><label>Título do procedimento<input data-document-procedure-title value="${escapeHtml(review.procedimentoTitulo || "")}"></label>${renderLines("PROCEDIMENTO", "Procedimento")}${renderLines("EQUIPE", "Equipe", true)}${renderLines("EQUIPAMENTO", "Equipamentos", true)}${renderLines("PREMISSA", "Premissas")}${renderLines("OBRIGACAO", "Obrigações da contratante")}<section class="document-review__section"><h3>Proposta financeira</h3><p>Origem: dados oficiais da proposta comercial.</p>${(review.financeiro || []).map((item) => `<div>${escapeHtml(item.descricao)} — R$ ${escapeHtml(item.preco_unitario)} × ${escapeHtml(item.quantidade)}</div>`).join("")}</section></main><footer><button type="button" data-document-close>Cancelar</button><button type="button" data-document-save>Salvar rascunho</button><button type="button" data-document-preview>Continuar para pré-visualização</button></footer></div>`;
        document.body.appendChild(modal);
        const documentNotice = modal.querySelector(".document-review__notice");
        const introductionField = modal.querySelector("[data-document-introduction]")?.closest("label");
        const procedureTitleField = modal.querySelector("[data-document-procedure-title]")?.closest("label");
        const generalSection = modal.querySelector(".document-review__general");
        if (documentNotice && introductionField && procedureTitleField && generalSection) {
            const overviewSection = document.createElement("section");
            overviewSection.className = "document-review__section document-review__section--offshore-overview";
            overviewSection.innerHTML = "<h3>Introdução e procedimento</h3>";
            documentNotice.classList.add("document-review__notice--offshore");
            overviewSection.append(documentNotice, introductionField, procedureTitleField);
            generalSection.after(overviewSection);
        }
        const close = () => {
            modal.remove();
            document.body.classList.remove("comercial-proposal-modal-open", "comercial-no-scroll");
        };

        const saveReview = async (notify = true) => {
            const linhasPayload = {};
            modal.querySelectorAll("[data-document-kind]").forEach((block) => {
                linhasPayload[block.dataset.documentKind] = [...block.querySelectorAll(".document-review__line")].map((row) => ({
                    descricao: row.querySelector("input").value,
                    quantidade: row.querySelector(".document-review__quantity")?.value || "",
                }));
            });

            const confirmacoes = {};
            modal.querySelectorAll("[data-document-kind]").forEach((block) => {
                const key = {
                    PROCEDIMENTO: "procedimento",
                    EQUIPE: "equipe",
                    EQUIPAMENTO: "equipamentos",
                    PREMISSA: "premissas",
                    OBRIGACAO: "obrigacoes",
                }[block.dataset.documentKind];
                confirmacoes[key] = block.querySelector("[data-document-confirm]").checked;
            });

            const response = await fetchJson(
                buildEndpoint(state.endpoints.documentReviewSavePattern, proposalId),
                {
                    method: "POST",
                    body: JSON.stringify({
                        document_type: documentType,
                        introducao: modal.querySelector("[data-document-introduction]").value,
                        procedimentoTitulo: modal.querySelector("[data-document-procedure-title]").value,
                        linhas: linhasPayload,
                        confirmacoes,
                    }),
                },
            );

            if (notify) {
                showNotification({
                    type: "success",
                    title: "Rascunho salvo",
                    message: "A revisão documental foi salva.",
                });
            }
            return response;
        };

        modal.addEventListener("click", async (event) => {
            if (event.target.closest("[data-document-close]")) return close();
            const section = event.target.closest("[data-document-kind]");
            if (event.target.closest("[data-document-add]")) section.querySelector(".document-review__lines").insertAdjacentHTML("beforeend", `<div class="document-review__line"><input placeholder="Descreva o conteúdo"><input class="document-review__quantity ${section.dataset.documentKind === "EQUIPE" || section.dataset.documentKind === "EQUIPAMENTO" ? "" : "is-hidden"}" placeholder="Qtd./POB"><button type="button" data-document-remove>Remover</button></div>`);
            if (event.target.closest("[data-document-remove]")) event.target.closest(".document-review__line").remove();
            if (event.target.closest("[data-document-save]")) {
                try {
                    await saveReview();
                } catch (error) {
                    showNotification({
                        type: "warning",
                        title: "Não foi possível salvar",
                        message: error.message || "Revise os dados e tente novamente.",
                    });
                }
            }
            if (event.target.closest("[data-document-preview]")) {
                try {
                    await saveReview(false);
                    const querySeparator = pdfEndpoint.includes("?") ? "&" : "?";
                    await previewProposalPdf(`${pdfEndpoint}${querySeparator}document_mode=preview&preview_format=images`, `${pdfEndpoint}${querySeparator}document_mode=final`, filename);
                } catch (error) {
                    showNotification({
                        type: "warning",
                        title: "Pré-visualização indisponível",
                        message: error.message || "Não foi possível salvar a revisão antes da pré-visualização.",
                    });
                }
            }
        });
    }

    async function uploadProposalDocuments(files) {
        const proposal = getSelectedProposal();
        const endpoint = buildEndpoint(state.endpoints.attachmentUploadPattern, proposal?.id);
        if (!proposal || !endpoint || !files.length) {
            return;
        }

        const formData = new FormData();
        files.forEach((file) => formData.append("arquivos", file));

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                credentials: "same-origin",
                headers: { "X-CSRFToken": getCsrfToken() },
                body: formData,
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload?.message || payload?.errors?.join(" ") || "Não foi possível enviar os documentos.");
            }

            proposal.anexos = [...(proposal.anexos || []), ...(payload.anexos || [])];
            renderProposalPanel();
            showNotification({
                type: "success",
                title: "Documentos anexados",
                message: payload.message || "Os documentos foram anexados à proposta."
            });
        } catch (error) {
            showNotification({
                type: "warning",
                title: "Erro ao anexar documentos",
                message: error.message || "Não foi possível enviar os documentos selecionados."
            });
        }
    }

    async function deleteProposalDocument(endpoint, documentId) {
        const proposal = getSelectedProposal();
        if (!proposal || !endpoint || !documentId) {
            return;
        }

        try {
            const payload = await fetchJson(endpoint, { method: "POST" });
            proposal.anexos = (proposal.anexos || []).filter((attachment) => Number(attachment.id) !== Number(documentId));
            renderProposalPanel();
            showNotification({
                type: "success",
                title: "Documento excluído",
                message: payload.message || "O documento foi removido da proposta."
            });
        } catch (error) {
            showNotification({
                type: "warning",
                title: "Erro ao excluir documento",
                message: error.message || "Não foi possível remover o documento."
            });
        }
    }

    function closeProposalModal() {
        refs.newProposalModal.classList.remove("is-open");
        refs.newProposalModal.setAttribute("aria-hidden", "true");
        hideProposalModalAlert();
        setFeedback("");
        syncOverlayState();
    }

    function closeModal(modal) {
        if (modal === refs.newProposalModal) {
            closeProposalModal();
        }
    }

    function closeOverlays() {
        if (refs.newProposalModal.classList.contains("is-open")) {
            closeProposalModal();
        }
            if (refs.proposalDrawer.classList.contains("is-open")) {
                closeProposalPanel();
            }
    }

    function syncOverlayState() {
        const anyOpen = refs.newProposalModal.classList.contains("is-open")
            || refs.proposalDrawer.classList.contains("is-open")
            || refs.fullFollowupAgendaModal?.classList.contains("is-open");
        refs.overlayBackdrop.classList.toggle("is-visible", anyOpen);
        document.body.classList.toggle("comercial-no-scroll", anyOpen);
        document.body.classList.toggle(
            "comercial-proposal-modal-open",
            refs.newProposalModal.classList.contains("is-open")
        );
    }

    function resetModalState() {
        state.modalStep = 1;
        state.createProposalError = false;
        state.createProposalErrorFields = {};
        resetNewProposalForm();
        state.criticalAnalysisAnswers = {};
        resetProposalItemsState();
        clearAllErrors();
        hideProposalModalAlert();
        setFeedback("");
        updateModalStep();
        renderProposalItemsSection();
        renderCriticalAnalysisControls();
    }

    function resetNewProposalForm() {
        refreshProposalNumberField();
        [
            "proposalEmissao",
            "proposalDataSolicitacao",
            "proposalDataEntrega",
            "proposalPrevisao",
            "proposalFechamento",
            "proposalFollowup",
            "proposalFollowupDescription",
            "proposalMotivo",
            "proposalAnaliseComentario",
            "proposalPo",
            "proposalSolicitante",
            "proposalEmailSolicitante",
            "proposalTelefoneSolicitante"
        ].forEach((fieldId) => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.value = "";
            }
        });
        state.proposalDraftServices = [""];
        renderProposalServiceRows();
        closeQuickClientForm();
        closeQuickUnitForm();
        closeQuickMethodForm();
        closeQuickServiceForm();
        closeQuickItemForm();
        closeQuickSegmentForm();
        updateQuickUnitClientHint();
    }

    function lockProposalNumberField() {
        if (!refs.proposalNumero) {
            return;
        }
        refs.proposalNumero.readOnly = true;
        refs.proposalNumero.setAttribute("readonly", "readonly");
        refs.proposalNumero.setAttribute("aria-readonly", "true");
    }

    function refreshProposalNumberField(value = null) {
        if (!refs.proposalNumero) {
            return;
        }
        const candidateValue = value ?? state.nextProposalNumber ?? 1;
        const nextValue = Number(candidateValue) || 1;
        refs.proposalNumero.value = String(nextValue);
        lockProposalNumberField();
    }

    function getProposalServiceOptions() {
        const options = commercialBootstrap?.metadata?.servicos;
        return Array.isArray(options) ? options.filter(Boolean) : [];
    }

    function syncProposalEscopoFromServices() {
        const serviceField = document.getElementById("proposalServico");
        const scopeField = document.getElementById("proposalEscopo");
        const services = (state.proposalDraftServices || [])
            .map((item) => String(item || "").trim())
            .filter(Boolean);

        if (serviceField) {
            serviceField.value = services.join(" | ");
        }

        if (scopeField) {
            scopeField.value = services.join(" | ");
        }
    }

    function renderProposalServiceRows() {
        const editor = document.getElementById("proposalServicesEditor");
        if (!editor) {
            syncProposalEscopoFromServices();
            return;
        }

        const options = getProposalServiceOptions();
        const rows = (state.proposalDraftServices && state.proposalDraftServices.length)
            ? state.proposalDraftServices
            : [""];

        editor.innerHTML = `
            ${rows.map((service, index) => `
                <div class="proposal-service-row">
                    <select data-proposal-service-index="${index}">
                        <option value="">Selecione o serviço</option>
                        ${options.map((option) => `
                            <option value="${escapeHtml(option)}" ${option === service ? "selected" : ""}>${escapeHtml(option)}</option>
                        `).join("")}
                    </select>
                    <button class="panel-button panel-button--soft proposal-service-row__remove" data-proposal-service-remove="${index}" type="button">
                        Remover
                    </button>
                </div>
            `).join("")}
            <button class="panel-button panel-button--soft proposal-services-editor__add" id="addProposalServiceRow" type="button">
                <span class="material-icons" aria-hidden="true">add</span>
                Adicionar serviço
            </button>
        `;

        syncProposalEscopoFromServices();
    }

    function addProposalServiceRow() {
        state.proposalDraftServices = [...(state.proposalDraftServices || []), ""];
        renderProposalServiceRows();
        const rows = document.querySelectorAll("[data-proposal-service-index]");
        rows[rows.length - 1]?.focus();
    }

    function removeProposalServiceRow(index) {
        const nextServices = (state.proposalDraftServices || []).filter((_, serviceIndex) => serviceIndex !== index);
        state.proposalDraftServices = nextServices.length ? nextServices : [""];
        renderProposalServiceRows();
    }

    function updateProposalServiceRow(index, value) {
        const nextServices = [...(state.proposalDraftServices || [])];
        nextServices[index] = value;
        state.proposalDraftServices = nextServices;
        syncProposalEscopoFromServices();
        clearProposalFieldError("proposalServico");
    }

    function appendOptionAndSelect(selectElement, value, label) {
        if (!selectElement || !value) {
            return;
        }

        const existingOption = [...selectElement.options].find((option) => option.value === value);
        if (!existingOption) {
            const optionNode = document.createElement("option");
            optionNode.value = value;
            optionNode.textContent = label || value;
            selectElement.appendChild(optionNode);
        }

        selectElement.value = value;
        selectElement.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function updateMetadataList(key, value) {
        if (!value) {
            return;
        }
        if (!commercialBootstrap.metadata) {
            commercialBootstrap.metadata = {};
        }
        const currentList = Array.isArray(commercialBootstrap.metadata[key]) ? commercialBootstrap.metadata[key] : [];
        if (!currentList.includes(value)) {
            currentList.push(value);
            currentList.sort((a, b) => a.localeCompare(b, "pt-BR"));
        }
        commercialBootstrap.metadata[key] = currentList;
    }

    function openQuickClientForm() {
        refs.quickClientForm?.classList.remove("is-hidden");
        refs.quickClientName?.focus();
    }

    function closeQuickClientForm() {
        refs.quickClientForm?.classList.add("is-hidden");
        if (refs.quickClientName) {
            refs.quickClientName.value = "";
            clearProposalFieldError("quickClientName");
        }
    }

    async function saveQuickClient() {
        const nome = refs.quickClientName?.value?.trim() || "";
        if (!nome) {
            setProposalFieldError("quickClientName", "Informe o nome do cliente.");
            refs.quickClientName?.focus();
            return;
        }

        if (!state.endpoints.quickClientCreate) {
            showNotification({ type: "warning", title: "Integração indisponível", message: "O cadastro rápido de cliente não foi configurado." });
            return;
        }

        try {
            setButtonLoading(refs.saveQuickClientButton, true, "Salvando...");
            const response = await fetchJson(state.endpoints.quickClientCreate, {
                method: "POST",
                body: JSON.stringify({ nome })
            });
            const cliente = response?.cliente || {};
            await refreshCommercialCatalogs();
            updateMetadataList("clientes", cliente.value);
            appendOptionAndSelect(refs.proposalCliente, cliente.value, cliente.label);
            closeQuickClientForm();
            showNotification({ type: "success", title: "Cliente cadastrado com sucesso", message: `${cliente.label || cliente.value} já está selecionado na proposta.` });
            updateQuickUnitClientHint();
        } catch (error) {
            setProposalFieldError("quickClientName", error?.details?.nome || error.message || "Não foi possível cadastrar o cliente.");
        } finally {
            setButtonLoading(refs.saveQuickClientButton, false);
        }
    }

    function updateQuickUnitClientHint() {
        if (!refs.quickUnitClientHint) {
            return;
        }
        const selectedClient = refs.proposalCliente?.value?.trim() || "";
        refs.quickUnitClientHint.textContent = selectedClient
            ? `Cliente selecionado nesta proposta: ${selectedClient}. O modelo atual de Unidade é cadastrado apenas por nome.`
            : "Cadastre uma nova unidade para disponibilizá-la nesta proposta.";
    }

    function openQuickUnitForm() {
        refs.quickUnitForm?.classList.remove("is-hidden");
        updateQuickUnitClientHint();
        refs.quickUnitName?.focus();
    }

    function closeQuickUnitForm() {
        refs.quickUnitForm?.classList.add("is-hidden");
        if (refs.quickUnitName) {
            refs.quickUnitName.value = "";
            clearProposalFieldError("quickUnitName");
        }
    }

    async function saveQuickUnit() {
        const nome = refs.quickUnitName?.value?.trim() || "";
        if (!nome) {
            setProposalFieldError("quickUnitName", "Informe o nome da unidade.");
            refs.quickUnitName?.focus();
            return;
        }

        if (!state.endpoints.quickUnitCreate) {
            showNotification({ type: "warning", title: "Integração indisponível", message: "O cadastro rápido de unidade não foi configurado." });
            return;
        }

        try {
            setButtonLoading(refs.saveQuickUnitButton, true, "Salvando...");
            const response = await fetchJson(state.endpoints.quickUnitCreate, {
                method: "POST",
                body: JSON.stringify({
                    nome,
                    cliente: refs.proposalCliente?.value?.trim() || ""
                })
            });
            const unidade = response?.unidade || {};
            await refreshCommercialCatalogs();
            updateMetadataList("unidades", unidade.value);
            appendOptionAndSelect(refs.proposalUnidade, unidade.value, unidade.label);
            closeQuickUnitForm();
            showNotification({ type: "success", title: "Unidade cadastrada com sucesso", message: `${unidade.label || unidade.value} já está selecionada na proposta.` });
        } catch (error) {
            setProposalFieldError("quickUnitName", error?.details?.nome || error.message || "Não foi possível cadastrar a unidade.");
        } finally {
            setButtonLoading(refs.saveQuickUnitButton, false);
        }
    }

    function openQuickMethodForm() {
        refs.quickMethodForm?.classList.remove("is-hidden");
        refs.quickMethodName?.focus();
    }

    function closeQuickMethodForm() {
        refs.quickMethodForm?.classList.add("is-hidden");
        if (refs.quickMethodName) {
            refs.quickMethodName.value = "";
            clearProposalFieldError("quickMethodName");
        }
    }

    async function saveQuickMethod() {
        const nome = refs.quickMethodName?.value?.trim() || "";
        if (!nome) {
            setProposalFieldError("quickMethodName", "Informe o nome do método.");
            refs.quickMethodName?.focus();
            return;
        }

        if (!state.endpoints.quickMethodCreate) {
            showNotification({ type: "warning", title: "Integração indisponível", message: "O cadastro rápido de método não foi configurado." });
            return;
        }

        try {
            setButtonLoading(refs.saveQuickMethodButton, true, "Salvando...");
            const response = await fetchJson(state.endpoints.quickMethodCreate, {
                method: "POST",
                body: JSON.stringify({ nome })
            });
            const metodo = response?.metodo || {};
            await refreshCommercialCatalogs();
            updateMetadataList("metodoOptions", metodo.value);
            appendOptionAndSelect(document.getElementById("proposalMetodo"), metodo.value, metodo.label);
            closeQuickMethodForm();
            showNotification({ type: "success", title: "Método cadastrado com sucesso", message: `${metodo.label || metodo.value} já está selecionado na proposta.` });
        } catch (error) {
            setProposalFieldError("quickMethodName", error?.details?.nome || error.message || "Não foi possível cadastrar o método.");
        } finally {
            setButtonLoading(refs.saveQuickMethodButton, false);
        }
    }

    function openQuickServiceForm() {
        refs.quickServiceForm?.classList.remove("is-hidden");
        refs.quickServiceName?.focus();
    }

    function closeQuickServiceForm() {
        refs.quickServiceForm?.classList.add("is-hidden");
        if (refs.quickServiceName) {
            refs.quickServiceName.value = "";
            clearProposalFieldError("quickServiceName");
        }
    }

    async function saveQuickService() {
        const nome = refs.quickServiceName?.value?.trim() || "";
        if (!nome) {
            setProposalFieldError("quickServiceName", "Informe o nome do serviço.");
            refs.quickServiceName?.focus();
            return;
        }
        try {
            setButtonLoading(refs.saveQuickServiceButton, true, "Salvando...");
            const response = await fetchJson(state.endpoints.quickServiceCreate, { method: "POST", body: JSON.stringify({ nome }) });
            const servico = response?.servico || {};
            await refreshCommercialCatalogs();
            updateMetadataList("servicos", servico.value);
            const emptyIndex = (state.proposalDraftServices || []).findIndex((value) => !String(value || "").trim());
            if (emptyIndex >= 0) state.proposalDraftServices[emptyIndex] = servico.value;
            else state.proposalDraftServices.push(servico.value);
            renderProposalServiceRows();
            closeQuickServiceForm();
            showNotification({ type: "success", title: "Serviço cadastrado com sucesso", message: `${servico.label || servico.value} foi selecionado na proposta.` });
        } catch (error) {
            setProposalFieldError("quickServiceName", error?.details?.nome || error.message || "Não foi possível cadastrar o serviço.");
        } finally {
            setButtonLoading(refs.saveQuickServiceButton, false);
        }
    }

    function openQuickItemForm() {
        refs.quickItemForm?.classList.remove("is-hidden");
        refs.quickItemName?.focus();
    }

    function closeQuickItemForm() {
        refs.quickItemForm?.classList.add("is-hidden");
        if (refs.quickItemName) {
            refs.quickItemName.value = "";
            clearProposalFieldError("quickItemName");
        }
    }

    async function saveQuickItem() {
        const nome = refs.quickItemName?.value?.trim() || "";
        if (!nome) {
            setProposalFieldError("quickItemName", "Informe o nome do item ou equipamento.");
            refs.quickItemName?.focus();
            return;
        }
        try {
            setButtonLoading(refs.saveQuickItemButton, true, "Salvando...");
            const response = await fetchJson(state.endpoints.quickItemCreate, { method: "POST", body: JSON.stringify({ nome }) });
            const item = response?.item || {};
            await refreshCommercialCatalogs();
            const choices = Array.isArray(commercialBootstrap?.metadata?.financeiroCampoChoices)
                ? commercialBootstrap.metadata.financeiroCampoChoices : [];
            choices.push({ value: item.value, label: item.label || item.value, group: item.group || "Itens cadastrados" });
            commercialBootstrap.metadata.financeiroCampoChoices = choices;
            applyFinanceiroCampoChoices(choices);
            const emptyItem = state.proposalItems.find((proposalItem) => !proposalItem.item);
            if (emptyItem) emptyItem.item = item.value;
            else state.proposalItems.push({ ...createEmptyProposalItem(), item: item.value });
            renderProposalItemsSection();
            closeQuickItemForm();
            showNotification({ type: "success", title: "Item cadastrado com sucesso", message: `${item.label || item.value} foi selecionado na proposta.` });
        } catch (error) {
            setProposalFieldError("quickItemName", error?.details?.nome || error.message || "Não foi possível cadastrar o item ou equipamento.");
        } finally {
            setButtonLoading(refs.saveQuickItemButton, false);
        }
    }

    function openQuickSegmentForm() {
        refs.quickSegmentForm?.classList.remove("is-hidden");
        refs.quickSegmentName?.focus();
    }

    function closeQuickSegmentForm() {
        refs.quickSegmentForm?.classList.add("is-hidden");
        if (refs.quickSegmentName) {
            refs.quickSegmentName.value = "";
            clearProposalFieldError("quickSegmentName");
        }
    }

    async function saveQuickSegment() {
        const nome = refs.quickSegmentName?.value?.trim() || "";
        if (!nome) {
            setProposalFieldError("quickSegmentName", "Informe o nome do segmento.");
            refs.quickSegmentName?.focus();
            return;
        }
        try {
            setButtonLoading(refs.saveQuickSegmentButton, true, "Salvando...");
            const response = await fetchJson(state.endpoints.quickSegmentCreate, { method: "POST", body: JSON.stringify({ nome }) });
            const segmento = response?.segmento || {};
            await refreshCommercialCatalogs();
            updateMetadataList("segmentoOptions", segmento.value);
            appendOptionAndSelect(document.getElementById("proposalSegmento"), segmento.value, segmento.label);
            closeQuickSegmentForm();
            showNotification({ type: "success", title: "Segmento cadastrado com sucesso", message: `${segmento.label || segmento.value} já está selecionado na proposta.` });
        } catch (error) {
            setProposalFieldError("quickSegmentName", error?.details?.nome || error.message || "Não foi possível cadastrar o segmento.");
        } finally {
            setButtonLoading(refs.saveQuickSegmentButton, false);
        }
    }

    function updateModalStep() {
        document.querySelectorAll(".proposal-step-panel").forEach((panel) => {
            panel.classList.toggle("is-active", Number(panel.dataset.stepPanel) === state.modalStep);
        });

        refs.proposalStepper.querySelectorAll(".proposal-step").forEach((stepButton) => {
            const step = Number(stepButton.dataset.stepTarget);
            stepButton.classList.toggle("is-active", step === state.modalStep);
            stepButton.classList.toggle("is-complete", step < state.modalStep);
        });

        refs.proposalPrevButton.classList.toggle("is-hidden", state.modalStep === 1);
        refs.proposalDraftButton.classList.toggle("is-hidden", state.modalStep !== 5);
        refs.proposalNextButton.classList.toggle("is-hidden", state.modalStep === 5);
        refs.proposalSubmitButton.classList.toggle("is-hidden", state.modalStep !== 5);
    }

    function goToNextStep() {
        if (!validateCurrentStep()) {
            setFeedback("Preencha os campos obrigatórios destacados para continuar.", "error");
            return;
        }
        setFeedback("");
        state.modalStep = Math.min(5, state.modalStep + 1);
        updateModalStep();
    }

    function goToPreviousStep() {
        setFeedback("");
        state.modalStep = Math.max(1, state.modalStep - 1);
        updateModalStep();
    }

    function validateCurrentStep() {
        const fieldIds = modalFieldsByStep[state.modalStep] || [];
        let isValid = true;

        if (proposalWillNotParticipate()) {
            return true;
        }

        fieldIds.forEach((id) => {
            const field = document.getElementById(id);
            if (!field) {
                return;
            }
            if (!field.value.trim()) {
                field.closest(".proposal-field")?.classList.add("has-error");
                isValid = false;
            } else {
                clearFieldError(field);
            }
        });

        if (state.modalStep === 4 && !validateProposalItems()) {
            isValid = false;
        }

        if (state.modalStep === 4) {
            const selectedServices = (state.proposalDraftServices || [])
                .map((item) => String(item || "").trim())
                .filter(Boolean);
            if (!selectedServices.length) {
                setProposalFieldError("proposalServico", "Selecione pelo menos um serviço / escopo.");
                isValid = false;
            } else {
                clearProposalFieldError("proposalServico");
            }
        }

        return isValid;
    }

    function handleMockSubmit(message, triggerButton = null, loadingLabel = "Carregando...") {
        const isCreateAction = message.includes("Proposta");

        if (isCreateAction && !validateNewProposalForm()) {
            if (hasProposalItemErrors()) {
                state.modalStep = 4;
                updateModalStep();
                setFeedback("Revise os itens obrigatórios da proposta antes de continuar.", "error");
                showNotification({
                    type: "warning",
                    title: "Itens pendentes",
                    message: "Preencha item, preço unitário e quantidade para continuar."
                });
                return;
            }
            showCreateProposalError();
            showNotification({
                type: "warning",
                title: "Falha ao criar proposta",
                message: "Os dados n\u00e3o foram enviados corretamente. Revise as informa\u00e7\u00f5es obrigat\u00f3rias."
            });
            return;
        }

        if (!isCreateAction && !validateAllRequiredFields()) {
            setFeedback("Ainda existem campos obrigat\u00f3rios pendentes no formul\u00e1rio.", "error");
            showNotification({
                type: "warning",
                title: "Aten\u00e7\u00e3o",
                message: "Existem campos obrigat\u00f3rios pendentes."
            });
            return;
        }

        setButtonLoading(triggerButton, true, loadingLabel);
        setFeedback("Valida\u00e7\u00e3o conclu\u00edda. A\u00e7\u00e3o mockada executada com sucesso.", "success");

        window.setTimeout(() => {
            setButtonLoading(triggerButton, false);
            if (isCreateAction) {
                state.lastCreatedProposalPayload = buildMockProposalPayload();
                resetProposalItemsState();
                renderProposalItemsSection();
            }
            showNotification({
                type: "success",
                title: message.includes("Proposta") ? "Proposta criada com sucesso" : "Rascunho salvo com sucesso",
                message: message.includes("Proposta")
                    ? "PRO-2026-016 foi adicionada ao pipeline."
                    : "Os dados atuais foram salvos como rascunho mockado."
            });
            showBottomToast("Dados atualizados h\u00e1 poucos segundos");
        }, 720);
    }

    function validateAllRequiredFields() {
        const requiredFields = document.querySelectorAll("[data-required='true']");
        let isValid = true;

        requiredFields.forEach((field) => {
            if (!field.value.trim()) {
                field.closest(".proposal-field")?.classList.add("has-error");
                isValid = false;
            } else {
                clearFieldError(field);
            }
        });

        if (!isValid) {
            document.querySelector(".proposal-field.has-error input, .proposal-field.has-error select")?.focus();
        }

        return isValid;
    }

    function clearFieldError(field) {
        field.closest(".proposal-field")?.classList.remove("has-error");
    }

    function clearAllErrors() {
        document.querySelectorAll(".proposal-field.has-error").forEach((field) => field.classList.remove("has-error"));
    }

    function setFeedback(message, type = "") {
        refs.proposalModalFeedback.textContent = message;
        refs.proposalModalFeedback.classList.remove("is-error", "is-success");
        if (type) {
            refs.proposalModalFeedback.classList.add(type === "error" ? "is-error" : "is-success");
        }
    }

    function createEmptyProposalItem() {
        return {
            id: state.proposalItemCounter++,
            item: "",
            unitPrice: "",
            quantity: 1,
            subtotal: 0,
            errors: {}
        };
    }

    function createProposalItemFromBackend(rawItem = {}) {
        const parsedId = Number(rawItem.id || 0);
        return {
            id: parsedId || state.proposalItemCounter++,
            item: String(rawItem.nome || rawItem.item || ""),
            unitPrice: Number(rawItem.preco_unitario || rawItem.unitPrice || 0) || 0,
            quantity: Number(rawItem.quantidade || rawItem.quantity || 1) || 1,
            subtotal: Number(rawItem.subtotal || 0) || 0,
            errors: {}
        };
    }

    function resetProposalItemsState() {
        state.proposalItemCounter = 1;
        state.proposalItems = [createEmptyProposalItem()];
    }

    function renderProposalItemsSection() {
        if (!refs.proposalItemsList) {
            return;
        }

        refs.proposalItemsList.innerHTML = state.proposalItems.map((item) => renderProposalItemRow(item)).join("");
        updateProposalItemsTotal();
    }

    function renderProposalItemRow(item) {
        return `
            <div class="proposal-item-row" data-proposal-item-row="${item.id}">
                ${renderProposalItemField({
                    itemId: item.id,
                    field: "item",
                    label: "Item / Equipamento",
                    required: false,
                    error: item.errors.item,
                    control: `
                        <select data-proposal-item-field="item" data-item-id="${item.id}">
                            <option value="">Selecione o item</option>
                            ${renderProposalItemOptions(item.item)}
                        </select>
                    `
                })}
                ${renderProposalItemField({
                    itemId: item.id,
                    field: "unitPrice",
                    label: "Preço unitário",
                    required: false,
                    error: item.errors.unitPrice,
                    control: `
                        <div class="proposal-item-price">
                            <span>R$</span>
                            <input type="text" value="${escapeHtml(item.unitPrice ? formatCurrencyInputValue(item.unitPrice) : "")}" data-currency-input="without-symbol" data-proposal-item-field="unitPrice" data-item-id="${item.id}" inputmode="numeric" autocomplete="off" placeholder="0,00">
                        </div>
                    `
                })}
                ${renderProposalItemField({
                    itemId: item.id,
                    field: "quantity",
                    label: "Quantidade",
                    required: false,
                    error: item.errors.quantity,
                    control: `
                        <input type="number" min="1" step="1" value="${escapeHtml(String(item.quantity || 1))}" data-proposal-item-field="quantity" data-item-id="${item.id}">
                    `
                })}
                <div class="proposal-item-field">
                    <label>Subtotal</label>
                    <div class="proposal-item-subtotal">${escapeHtml(formatCurrencyDisplay(calculateProposalItemSubtotal(item)))}</div>
                </div>
                <button class="proposal-item-remove" data-proposal-item-remove="${item.id}" type="button" aria-label="Remover item">
                    <span class="material-icons" aria-hidden="true">delete</span>
                </button>
            </div>
        `;
    }

    function renderProposalItemField({ itemId, field, label, required, error, control }) {
        return `
            <div class="proposal-item-field ${error ? "has-error" : ""}" data-proposal-item-wrapper="${field}" data-item-id="${itemId}">
                <label>${label}${required ? " <em>*</em>" : ""}</label>
                ${control}
                <small class="proposal-item-field__error">${escapeHtml(error || "")}</small>
            </div>
        `;
    }

    function renderProposalItemOptions(selectedValue) {
        return PROPOSAL_ITEM_GROUPS.map((group) => `
            <optgroup label="${escapeHtml(group.label)}">
                ${group.options.map((option) => {
                    const optionValue = typeof option === "object" ? option.value : option;
                    const optionLabel = typeof option === "object" ? option.label : option;
                    return `<option value="${escapeHtml(optionValue)}" ${optionValue === selectedValue ? "selected" : ""}>${escapeHtml(optionLabel)}</option>`;
                }).join("")}
            </optgroup>
        `).join("");
    }

    function addProposalItemRow() {
        const nextItem = createEmptyProposalItem();
        state.proposalItems.push(nextItem);
        renderProposalItemsSection();
        window.requestAnimationFrame(() => {
            refs.proposalItemsList?.querySelector(`[data-proposal-item-field="item"][data-item-id="${nextItem.id}"]`)?.focus();
        });
    }

    function removeProposalItemRow(itemId) {
        state.proposalItems = state.proposalItems.filter((item) => item.id !== itemId);
        if (!state.proposalItems.length) {
            state.proposalItems = [createEmptyProposalItem()];
        }
        renderProposalItemsSection();
    }

    function updateProposalItem(itemId, field, value) {
        const item = state.proposalItems.find((entry) => entry.id === itemId);
        if (!item) {
            return;
        }

        if (field === "item") {
            item.item = value;
        } else if (field === "unitPrice") {
            item.unitPrice = parseCurrencyValue(value);
        } else if (field === "quantity") {
            item.quantity = Math.max(1, Number(value) || 1);
        }

        item.subtotal = calculateProposalItemSubtotal(item);
        clearProposalItemError(itemId, field);
        syncProposalItemRow(itemId, field);
        updateProposalItemsTotal();
    }

    function calculateProposalItemSubtotal(item) {
        return (Number(item.unitPrice) || 0) * (Number(item.quantity) || 0);
    }

    function updateProposalItemsTotal() {
        const total = state.proposalItems.reduce((sum, item) => sum + calculateProposalItemSubtotal(item), 0);
        if (refs.proposalItemsTotalValue) {
            refs.proposalItemsTotalValue.textContent = formatCurrencyDisplay(total);
        }
        return total;
    }

    function validateProposalItems() {
        let isValid = true;

        state.proposalItems = state.proposalItems.map((item) => {
            const errors = {};
            const hasName = Boolean(item.item);
            const hasPrice = Number(item.unitPrice) > 0;
            const hasQuantity = Number(item.quantity) > 0;
            const isBlankRow = !hasName && !hasPrice && (!item.quantity || Number(item.quantity) === 1);

            if (isBlankRow) {
                return {
                    ...item,
                    subtotal: 0,
                    errors: {}
                };
            }

            if (!hasName) {
                errors.item = "Selecione um item.";
            }

            if (!hasPrice) {
                errors.unitPrice = "Informe o preço unitário.";
            }

            if (!hasQuantity) {
                errors.quantity = "Informe uma quantidade válida.";
            }

            if (Object.keys(errors).length) {
                isValid = false;
            }

            return {
                ...item,
                subtotal: calculateProposalItemSubtotal(item),
                errors
            };
        });

        renderProposalItemsSection();

        if (!isValid) {
            window.requestAnimationFrame(() => {
                refs.proposalItemsList?.querySelector(".proposal-item-field.has-error select, .proposal-item-field.has-error input")?.focus();
            });
        }

        return isValid;
    }

    function clearProposalItemError(itemId, field) {
        const item = state.proposalItems.find((entry) => entry.id === itemId);
        if (!item?.errors) {
            return;
        }
        delete item.errors[field];
    }

    function hasProposalItemErrors() {
        return state.proposalItems.some((item) => Object.keys(item.errors || {}).length > 0);
    }

    function syncProposalItemRow(itemId, changedField = "") {
        const item = state.proposalItems.find((entry) => entry.id === itemId);
        const row = refs.proposalItemsList?.querySelector(`[data-proposal-item-row="${itemId}"]`);
        if (!item || !row) {
            return;
        }

        const subtotalNode = row.querySelector(".proposal-item-subtotal");
        if (subtotalNode) {
            subtotalNode.textContent = formatCurrencyDisplay(calculateProposalItemSubtotal(item));
        }

        if (changedField === "quantity") {
            const quantityField = row.querySelector('[data-proposal-item-field="quantity"]');
            if (quantityField) {
                quantityField.value = String(Math.max(1, Number(item.quantity) || 1));
            }
        }

        const itemField = row.querySelector('[data-proposal-item-wrapper="item"]');
        const unitPriceField = row.querySelector('[data-proposal-item-wrapper="unitPrice"]');
        const quantityFieldWrapper = row.querySelector('[data-proposal-item-wrapper="quantity"]');

        itemField?.classList.toggle("has-error", Boolean(item.errors?.item));
        unitPriceField?.classList.toggle("has-error", Boolean(item.errors?.unitPrice));
        quantityFieldWrapper?.classList.toggle("has-error", Boolean(item.errors?.quantity));

        const itemError = itemField?.querySelector(".proposal-item-field__error");
        const unitPriceError = unitPriceField?.querySelector(".proposal-item-field__error");
        const quantityError = quantityFieldWrapper?.querySelector(".proposal-item-field__error");

        if (itemError) itemError.textContent = item.errors?.item || "";
        if (unitPriceError) unitPriceError.textContent = item.errors?.unitPrice || "";
        if (quantityError) quantityError.textContent = item.errors?.quantity || "";
    }

    function buildMockProposalPayload() {
        const itemPayload = buildProposalItemsPayload();
        return {
            numeroProposta: document.getElementById("proposalNumero")?.value.trim() || "",
            rev: document.getElementById("proposalRev")?.value.trim() || "",
            cliente: document.getElementById("proposalCliente")?.value.trim() || "",
            unidade: document.getElementById("proposalUnidade")?.value.trim() || "",
            escopo: document.getElementById("proposalEscopo")?.value.trim() || "",
            estimativaReceita: document.getElementById("proposalReceita")?.value.trim() || "",
            campos: itemPayload.campos,
            totalItens: itemPayload.totalItens
        };
    }

    function buildProposalItemsPayload() {
        const itens = state.proposalItems
            .filter((item) => item.item || Number(item.unitPrice) > 0 || Number(item.quantity) > 1)
            .map((item) => ({
                nome: item.item,
                preco_unitario: normalizeCurrencyToDecimal(item.unitPrice),
                quantidade: String(Number(item.quantity) || 0),
                subtotal: normalizeCurrencyToDecimal(calculateProposalItemSubtotal(item))
            }));

        return {
            campos: itens,
            totalItens: itens.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0)
        };
    }

    function buildProposalRequestPayload() {
        const valueOf = (id) => document.getElementById(id)?.value?.trim() || "";
        syncProposalEscopoFromServices();

        return {
            proposta: valueOf("proposalNumero"),
            revisao: valueOf("proposalRev"),
            data_emissao: valueOf("proposalEmissao"),
            data_entrega_proposta: valueOf("proposalDataEntrega"),
            data_solicitacao_proposta: valueOf("proposalDataSolicitacao"),
            data_fechamento_proposta: valueOf("proposalFechamento"),
            previsao_contratacao: valueOf("proposalPrevisao"),
            follow_up: valueOf("proposalFollowupDescription"),
            follow_up_date: valueOf("proposalFollowup"),
            natureza: valueOf("proposalNatureza"),
            heat_map: valueOf("proposalHeatMap"),
            motivo_perda: valueOf("proposalMotivo"),
            po: valueOf("proposalPo"),
            cliente: valueOf("proposalCliente"),
            unidade: valueOf("proposalUnidade"),
            solicitante: valueOf("proposalSolicitante"),
            email_solicitante: valueOf("proposalEmailSolicitante"),
            telefone_solicitante: valueOf("proposalTelefoneSolicitante"),
            tipo_operacao: valueOf("proposalTipoOperacao"),
            metodo: valueOf("proposalMetodo"),
            status_proposta: valueOf("proposalStatus"),
            cordenador: valueOf("proposalCoordenador"),
            responsavel: valueOf("proposalResponsavel"),
            servico: valueOf("proposalServico"),
            comentario: "",
            requisitos_cliente: "",
            requisitos_ambipar: "",
            treinamentos: "",
            ajuste_operacional: "",
            // The completion status is calculated exclusively by the backend from these answers.
            analise_critica_oportunidade: getCriticalAnalysisPayload(),
            pt_financeiro: valueOf("proposalPt"),
            pc_ptc: valueOf("proposalPc"),
            uf: valueOf("proposalUf"),
            estimativo_receita: valueOf("proposalReceita"),
            fonte_lead: valueOf("proposalFonteLead"),
            segmento_cliente: valueOf("proposalSegmento"),
            tempo_contrato_dias: valueOf("proposalPrazo"),
            escopo: valueOf("proposalEscopo"),
            campos: buildProposalItemsPayload().campos
        };
    }

    function focusFieldById(fieldId) {
        document.getElementById(fieldId)?.focus();
    }

    function proposalStatusRequiresReason() {
        const status = document.getElementById("proposalStatus")?.value?.trim() || "";
        return ["Perdida/Recusada", "Cancelada", "DeclÃ­nio"].includes(status);
    }

    function applyProposalBackendErrors(errors = {}) {
        state.createProposalError = true;
        state.createProposalErrorFields = {};

        const fieldMap = {
            proposta: "proposalNumero",
            revisao: "proposalRev",
            data_emissao: "proposalEmissao",
            data_solicitacao_proposta: "proposalDataSolicitacao",
            data_entrega_proposta: "proposalDataEntrega",
            responsavel: "proposalResponsavel",
            natureza: "proposalNatureza",
            status_proposta: "proposalStatus",
            motivo_perda: "proposalMotivo",
            cliente: "proposalCliente",
            unidade: "proposalUnidade",
            servico: "proposalServico",
            estimativo_receita: "proposalReceita"
        };

        Object.entries(errors).forEach(([backendField, message]) => {
            const itemErrorMatch = backendField.match(/^campos\[(\d+)\]\.(nome|preco_unitario|quantidade)$/);
            if (itemErrorMatch) {
                const itemIndex = Number(itemErrorMatch[1]);
                const backendItemField = itemErrorMatch[2];
                const targetItem = state.proposalItems[itemIndex];
                if (targetItem) {
                    const frontItemFieldMap = {
                        nome: "item",
                        preco_unitario: "unitPrice",
                        quantidade: "quantity"
                    };
                    targetItem.errors = {
                        ...(targetItem.errors || {}),
                        [frontItemFieldMap[backendItemField]]: message
                    };
                    state.modalStep = 4;
                }
                return;
            }

            const frontField = fieldMap[backendField];
            if (!frontField) {
                return;
            }
            state.createProposalErrorFields[frontField] = message;
            setProposalFieldError(frontField, message);
        });

        if (state.modalStep === 4) {
            updateModalStep();
            renderProposalItemsSection();
            window.requestAnimationFrame(() => {
                refs.proposalItemsList?.querySelector(".proposal-item-field.has-error select, .proposal-item-field.has-error input")?.focus();
            });
        }

        if (Object.keys(state.createProposalErrorFields).length) {
            const firstFieldId = Object.keys(state.createProposalErrorFields)[0];
            if (["proposalCliente", "proposalUnidade", "proposalTipoOperacao", "proposalDataSolicitacao", "proposalDataEntrega"].includes(firstFieldId)) {
                state.modalStep = 3;
            } else if (["proposalServico", "proposalReceita"].includes(firstFieldId)) {
                state.modalStep = 4;
            } else if (["proposalStatus", "proposalMotivo"].includes(firstFieldId)) {
                state.modalStep = 5;
            } else {
                state.modalStep = 2;
            }
            updateModalStep();
            focusFieldById(firstFieldId);
        }
        renderProposalModalAlert();
    }

    async function handleMockSubmit(message, triggerButton = null, loadingLabel = "Carregando...") {
        const isCreateAction = message.includes("Proposta");
        if (!isCreateAction) {
            setButtonLoading(triggerButton, true, loadingLabel);
            setFeedback("Validação concluída. Ação mockada executada com sucesso.", "success");
            window.setTimeout(() => {
                setButtonLoading(triggerButton, false);
                showNotification({
                    type: "success",
                    title: "Rascunho salvo com sucesso",
                    message: "Os dados atuais foram salvos como rascunho mockado."
                });
                showBottomToast("Dados atualizados há poucos segundos");
            }, 420);
            return;
        }

        if (!validateNewProposalForm()) {
            if (hasProposalItemErrors()) {
                state.modalStep = 4;
                updateModalStep();
                setFeedback("Revise os itens obrigatórios da proposta antes de continuar.", "error");
            } else {
                showCreateProposalError();
            }
            showNotification({
                type: "warning",
                title: "Falha ao criar proposta",
                message: "Os dados não foram enviados corretamente. Revise as informações obrigatórias."
            });
            return;
        }

        if (!state.endpoints.create) {
            showNotification({
                type: "warning",
                title: "Integração indisponível",
                message: "O endpoint de criação da proposta não foi configurado."
            });
            return;
        }

        try {
            setButtonLoading(triggerButton, true, loadingLabel);
            setFeedback("Enviando proposta para o backend...", "success");
            const payload = buildProposalRequestPayload();
            const response = await fetchJson(state.endpoints.create, {
                method: "POST",
                body: JSON.stringify(payload)
            });

            const createdProposal = upsertProposal(response?.proposal || {});
            state.nextProposalNumber = Number(response?.nextProposalNumber || (Number(createdProposal?.id) + 1) || state.nextProposalNumber || 1);
            state.lastCreatedProposalPayload = payload;
            resetProposalItemsState();
            renderProposalItemsSection();
            closeProposalModal();
            renderAll();
            openFocusedStageView(createdProposal.kanbanStage || "Em Análise");
            showNotification({
                type: "success",
                title: "Proposta criada com sucesso",
                message: `${createdProposal.numeroProposta || "Nova proposta"} foi adicionada ao pipeline.`
            });
            showBottomToast("Dados atualizados há poucos segundos");
        } catch (error) {
            setFeedback(error.message || "Não foi possível criar a proposta.", "error");
            applyProposalBackendErrors(error.details || {
                proposta: error.message || "Não foi possível criar a proposta."
            });
            showNotification({
                type: "warning",
                title: "Falha ao criar proposta",
                message: error.message || "Os dados não foram enviados corretamente. Revise as informações obrigatórias."
            });
        } finally {
            setButtonLoading(triggerButton, false);
        }
    }

    function _validateNewProposalFormLegacy() {
        const validations = {
            proposalRev: "Informe a revisão.",
            proposalEmissao: "Informe a emissão.",
            proposalResponsavel: "Selecione um responsável.",
            proposalNatureza: "Selecione a natureza.",
            proposalStatus: "Selecione o status da proposta.",
            proposalCliente: "Selecione um cliente.",
            proposalUnidade: "Selecione uma unidade.",
            proposalServico: "Selecione o serviço.",
            proposalDataSolicitacao: "Informe a data de solicitação da proposta.",
            proposalDataEntrega: "Informe a data prevista.",
            proposalReceita: "Informe a estimativa de receita."
        };

        let isValid = true;
        state.createProposalErrorFields = {};

        Object.entries(validations).forEach(([fieldId, message]) => {
            const field = document.getElementById(fieldId);
            if (!field || field.value.trim()) {
                clearProposalFieldError(fieldId);
                return;
            }
            state.createProposalErrorFields[fieldId] = message;
            setProposalFieldError(fieldId, message);
            isValid = false;
        });

        if (proposalStatusRequiresReason()) {
            const reasonField = document.getElementById("proposalMotivo");
            if (!reasonField?.value.trim()) {
                state.createProposalErrorFields.proposalMotivo = "Informe o motivo de declÃ­nio/perda.";
                setProposalFieldError("proposalMotivo", "Informe o motivo de declÃ­nio/perda.");
                isValid = false;
            } else {
                clearProposalFieldError("proposalMotivo");
            }
        } else {
            clearProposalFieldError("proposalMotivo");
        }

        if (!validateProposalItems()) {
            isValid = false;
        }

        state.createProposalError = !isValid;
        if (!isValid) {
            renderProposalModalAlert();
        } else {
            hideProposalModalAlert();
        }
        return isValid;
    }

    function validateNewProposalForm() {
        const validations = {
            proposalRev: "Informe a revisão.",
            proposalEmissao: "Informe a emissão.",
            proposalResponsavel: "Selecione um responsável.",
            proposalNatureza: "Selecione a natureza.",
            proposalStatus: "Selecione o status da proposta.",
            proposalCliente: "Selecione um cliente.",
            proposalUnidade: "Selecione uma unidade.",
            proposalServico: "Selecione o serviço.",
            proposalDataEntrega: "Informe a data prevista.",
            proposalReceita: "Informe a estimativa de receita."
        };

        let isValid = true;
        state.createProposalErrorFields = {};

        Object.entries(validations).forEach(([fieldId, message]) => {
            const field = document.getElementById(fieldId);
            if (!field || field.value.trim()) {
                clearProposalFieldError(fieldId);
                return;
            }
            state.createProposalErrorFields[fieldId] = message;
            setProposalFieldError(fieldId, message);
            isValid = false;
        });

        if (!validateProposalItems()) {
            isValid = false;
        }

        state.createProposalError = !isValid;
        if (!isValid) {
            renderProposalModalAlert();
        } else {
            hideProposalModalAlert();
        }
        return isValid;
    }

    function showCreateProposalError() {
        if (!refs.newProposalModal.classList.contains("is-open")) {
            openProposalModal();
        }
        state.createProposalError = true;
        state.modalStep = 2;
        updateModalStep();
        if (!Object.keys(state.createProposalErrorFields).length) {
            state.createProposalErrorFields = {
                proposalCliente: "Selecione um cliente.",
                proposalUnidade: "Selecione uma unidade.",
                proposalDataEntrega: "Informe a data prevista."
            };
        }
        renderProposalModalAlert();
        Object.entries(state.createProposalErrorFields).forEach(([fieldId, message]) => {
            setProposalFieldError(fieldId, message);
        });
    }

    function renderProposalModalAlert() {
        if (!refs.proposalModalAlert) {
            return;
        }

        if (!state.createProposalError) {
            hideProposalModalAlert();
            return;
        }

        refs.proposalModalAlert.classList.remove("is-hidden");
        refs.proposalModalAlert.innerHTML = `
            <div class="proposal-modal-error">
                <div class="proposal-modal-error__copy">
                    <span class="material-icons" aria-hidden="true">warning</span>
                    <div>
                        <strong>Não foi possível criar a proposta</strong>
                        <p>Os dados não foram enviados corretamente. Revise as informações obrigatórias.</p>
                    </div>
                </div>
                <div class="proposal-modal-error__actions">
                    <button class="proposal-button proposal-button--primary" data-proposal-error-review type="button">Revisar campos</button>
                    <button class="proposal-button proposal-button--ghost" data-proposal-error-close type="button">Fechar</button>
                </div>
            </div>
        `;
    }

    function hideProposalModalAlert() {
        if (!refs.proposalModalAlert) {
            return;
        }
        refs.proposalModalAlert.classList.add("is-hidden");
        refs.proposalModalAlert.innerHTML = "";
    }

    function setProposalFieldError(fieldId, message) {
        const field = document.getElementById(fieldId);
        if (!field) {
            return;
        }
        const wrapper = field.closest(".proposal-field");
        wrapper?.classList.add("has-error");
        const errorNode = wrapper?.querySelector(".proposal-field__error");
        if (errorNode) {
            errorNode.textContent = message;
        }
    }

    function clearProposalFieldError(fieldId) {
        const field = document.getElementById(fieldId);
        if (!field) {
            return;
        }
        const wrapper = field.closest(".proposal-field");
        wrapper?.classList.remove("has-error");
        delete state.createProposalErrorFields[fieldId];
        if (!Object.keys(state.createProposalErrorFields).length) {
            state.createProposalError = false;
            hideProposalModalAlert();
        }
    }

    function focusFirstProposalErrorField() {
        const firstErrorField = Object.keys(state.createProposalErrorFields)[0];
        if (!firstErrorField) {
            return;
        }
        document.getElementById(firstErrorField)?.focus();
    }

    function showNotification({ type = "info", title = "", message = "", duration } = {}) {
        const toastDuration = duration ?? getNotificationDuration(type);
        const iconMap = {
            success: "check_circle",
            info: "filter_alt",
            warning: "warning_amber",
            update: "event"
        };

        const toast = document.createElement("article");
        toast.className = `commercial-notification commercial-notification--${type}`;
        toast.innerHTML = `
            <span class="commercial-notification__icon">
                <span class="material-icons" aria-hidden="true">${iconMap[type] || "notifications"}</span>
            </span>
            <div class="commercial-notification__content">
                <strong class="commercial-notification__title">${escapeHtml(title || "Notificação")}</strong>
                <span class="commercial-notification__message">${escapeHtml(message)}</span>
            </div>
            <button class="commercial-notification__close" type="button" aria-label="Fechar notificação">
                <span class="material-icons" aria-hidden="true">close</span>
            </button>
        `;

        const closeButton = toast.querySelector(".commercial-notification__close");
        const closeToast = () => {
            toast.classList.add("is-closing");
            window.setTimeout(() => {
                toast.remove();
            }, 220);
        };

        closeButton.addEventListener("click", closeToast);
        refs.commercialNotifications.appendChild(toast);

        window.requestAnimationFrame(() => {
            toast.classList.add("is-visible");
        });

        window.setTimeout(closeToast, toastDuration);
    }

    function showBottomToast(message, duration = 3000) {
        refs.commercialBottomToast.innerHTML = `
            <span class="commercial-toast-bottom__icon">
                <span class="material-icons" aria-hidden="true">autorenew</span>
            </span>
            <span class="commercial-toast-bottom__message">${escapeHtml(message)}</span>
            <button class="commercial-toast-bottom__close" type="button" aria-label="Fechar atualização">
                <span class="material-icons" aria-hidden="true">close</span>
            </button>
        `;

        const closeToast = () => {
            refs.commercialBottomToast.classList.remove("is-visible");
        };

        refs.commercialBottomToast.querySelector(".commercial-toast-bottom__close")?.addEventListener("click", closeToast);
        refs.commercialBottomToast.classList.add("is-visible");

        window.clearTimeout(state.toastTimer);
        state.toastTimer = window.setTimeout(closeToast, duration);
    }

    function showToast(message) {
        showBottomToast(message);
    }

    function showComercialLoading() {
        if (!refs.comercialLoadingScreen) {
            return;
        }

        document.body.classList.add("comercial-is-loading");
        refs.comercialLoadingScreen.classList.remove("is-hidden");
    }

    function hideComercialLoading() {
        if (!refs.comercialLoadingScreen) {
            return;
        }

        state.loadingTimers.forEach((timer) => window.clearTimeout(timer));
        state.loadingTimers = [];
        refs.comercialLoadingScreen.classList.add("is-hidden");

        window.setTimeout(() => {
            document.body.classList.remove("comercial-is-loading");
        }, 180);
    }

    function simulateComercialLoading() {
        if (!refs.comercialLoadingScreen) {
            return;
        }

        showComercialLoading();
        state.loadingTimers.forEach((timer) => window.clearTimeout(timer));
        state.loadingTimers = [];

        state.loadingTimers.push(window.setTimeout(() => {
            hideComercialLoading();
        }, 1540));
    }

    function getNotificationDuration(type) {
        const durationByType = {
            success: 4000,
            info: 4000,
            warning: 5600,
            update: 3000
        };

        return durationByType[type] || 4000;
    }

    function saveCommercialData() {
        const proposal = getSelectedProposal();
        if (!proposal) {
            return;
        }

        if (state.saveProposalError) {
            showSaveProposalError();
            return;
        }

        const updatedValues = readFieldValues([
            "rev", "responsavel", "dataEntregaProposta", "dataSolicitacaoProposta", "dataFechamento", "previsaoContratacao", "followUp",
            "natureza", "unidade", "heatMap", "statusProposta", "motivoDeclinioPerda", "pt", "pcPtc",
            "empresa", "uf", "embarcacaoLocal", "solicitante", "emailSolicitante", "telefoneSolicitante", "po", "rfi", "fonteLead", "segmentoCliente", "comentario"
        ]);

        if (!updatedValues.empresa || !updatedValues.dataEntregaProposta) {
            showNotification({
                type: "warning",
                title: "Atenção",
                message: "Preencha os dados principais antes de continuar."
            });
            return;
        }

        Object.assign(proposal, updatedValues);
        state.dataEditMode = false;
        addHistory(proposal, "Dados comerciais atualizados", "Campos comerciais e de controle foram atualizados no painel.");
        renderAll();
        showNotification({
            type: "success",
            title: "Alterações salvas com sucesso",
            message: "Os dados comerciais da proposta foram atualizados."
        });
        showBottomToast("Dados atualizados há poucos segundos");
    }

    function saveScopeData() {
        const proposal = getSelectedProposal();
        if (!proposal) {
            return;
        }

        if (state.saveProposalError) {
            showSaveProposalError();
            return;
        }

        proposal.escopo = (state.scopeDraftServices || [])
            .map((service) => String(service || "").trim())
            .filter(Boolean)
            .join(" | ") || proposal.escopo;
        proposal.estimativaReceita = refs.proposalDrawer.querySelector("#scopeReceita")?.value.trim() || proposal.estimativaReceita;
        proposal.tempoContratoDias = refs.proposalDrawer.querySelector("#scopeTempo")?.value.trim() || proposal.tempoContratoDias;
        state.scopeEditMode = false;
        addHistory(proposal, "Escopo atualizado", "Escopo, receita estimada e tempo de contrato ajustados no mock.");
        renderAll();
        showNotification({
            type: "success",
            title: "Alterações salvas com sucesso",
            message: "Escopo e valores da proposta foram atualizados."
        });
        showBottomToast("Dados atualizados há poucos segundos");
    }

    function saveFollowup() {
        const proposal = getSelectedProposal();
        if (!proposal) {
            return;
        }

        const payload = {
            data: refs.proposalDrawer.querySelector("#followupData")?.value.trim(),
            hora: refs.proposalDrawer.querySelector("#followupHora")?.value.trim(),
            responsavel: refs.proposalDrawer.querySelector("#followupResponsavel")?.value.trim(),
            tipoContato: refs.proposalDrawer.querySelector("#followupTipo")?.value.trim(),
            comentario: refs.proposalDrawer.querySelector("#followupComentario")?.value.trim(),
            proximaAcao: refs.proposalDrawer.querySelector("#followupAcao")?.value.trim(),
            dataProximaAcao: refs.proposalDrawer.querySelector("#followupDataAcao")?.value.trim(),
            status: refs.proposalDrawer.querySelector("#followupStatus")?.value.trim()
        };

        if (!payload.data || !payload.comentario || !payload.status) {
            showNotification({
                type: "warning",
                title: "Atenção",
                message: "Preencha data, atualização e status do acompanhamento."
            });
            return;
        }

        proposal.followUps.unshift(payload);
        if (payload.dataProximaAcao) {
            proposal.followUp = payload.dataProximaAcao;
        }
        state.followupFormOpen = false;
        addHistory(proposal, "Acompanhamento registrado", `${payload.tipoContato} registrado por ${payload.responsavel}.`);
        renderAll();
        state.activeDetailTab = "followups";
        renderProposalPanel();
        showNotification({
            type: "success",
            title: "Acompanhamento registrado",
            message: "Histórico comercial atualizado."
        });
        showBottomToast("Dados atualizados há poucos segundos");
    }

    function saveStatusChange() {
        const proposal = getSelectedProposal();
        if (!proposal) {
            return;
        }

        const nextStatus = refs.proposalDrawer.querySelector("#panelStatusSelect")?.value || proposal.statusProposta;
        const reason = refs.proposalDrawer.querySelector("#panelReasonSelect")?.value || "";
        const needsReason = REASON_REQUIRED_STATUSES.has(nextStatus);

        if (needsReason && (!reason || reason === "Selecione o motivo")) {
            state.statusError = true;
            updateStatusReasonState();
            showNotification({
                type: "warning",
                title: "Atenção",
                message: "Existem campos obrigatórios pendentes."
            });
            return;
        }

        const previousStatus = proposal.statusProposta;
        proposal.statusProposta = nextStatus;
        proposal.motivoDeclinioPerda = needsReason ? reason : "";
        state.statusError = false;
        addHistory(proposal, "Status alterado", `Status alterado de ${previousStatus} para ${nextStatus}.`);
        renderAll();
        showNotification({
            type: "success",
            title: "Alterações salvas com sucesso",
            message: "O status da proposta foi atualizado."
        });
        showBottomToast("Dados atualizados há poucos segundos");
    }

    function saveQuickNote() {
        const proposal = getSelectedProposal();
        if (!proposal) {
            return;
        }
        const value = refs.proposalDrawer.querySelector("#panelQuickNote")?.value.trim();
        proposal.comentario = value || proposal.comentario;
        state.noteEditMode = false;
        addHistory(proposal, "Comentário atualizado", "Notas rápidas da proposta foram ajustadas.");
        renderAll();
        showNotification({
            type: "success",
            title: "Alterações salvas com sucesso",
            message: "As notas rápidas da proposta foram atualizadas."
        });
        showBottomToast("Dados atualizados há poucos segundos");
    }

    function createNewRevision() {
        const proposal = getSelectedProposal();
        if (!proposal) {
            return;
        }
        proposal.rev = String(Number(proposal.rev) + 1).padStart(2, "0");
        addHistory(proposal, "Revisão criada", `Nova revisão gerada: REV ${proposal.rev}.`);
        renderAll();
        showNotification({
            type: "success",
            title: "Nova revisão criada",
            message: `A proposta agora está na REV ${proposal.rev}.`
        });
        showBottomToast("Dados atualizados há poucos segundos");
    }

    function saveCommercialData() {
        const proposal = getSelectedProposal();
        if (!proposal) {
            return;
        }

        if (state.saveProposalError) {
            showSaveProposalError();
            return;
        }

        const updatedValues = readFieldValues([
            "rev", "responsavel", "dataEntregaProposta", "dataSolicitacaoProposta", "dataFechamento", "previsaoContratacao", "followUp",
            "natureza", "unidade", "heatMap", "statusProposta", "motivoDeclinioPerda", "pt", "pcPtc",
            "empresa", "uf", "embarcacaoLocal", "solicitante", "emailSolicitante", "telefoneSolicitante", "po", "rfi", "fonteLead", "segmentoCliente", "comentario"
        ]);

        if (!updatedValues.empresa || !updatedValues.dataEntregaProposta) {
            showNotification({
                type: "warning",
                title: "Atenção",
                message: "Preencha os dados principais antes de continuar."
            });
            return;
        }

        persistProposalUpdate(proposal.id, {
            revisao: updatedValues.rev,
            responsavel: updatedValues.responsavel,
            data_entrega_proposta: updatedValues.dataEntregaProposta,
            data_solicitacao_proposta: updatedValues.dataSolicitacaoProposta,
            data_fechamento_proposta: updatedValues.dataFechamento,
            previsao_contratacao: updatedValues.previsaoContratacao,
            follow_up: updatedValues.followUp,
            natureza: updatedValues.natureza,
            unidade: updatedValues.unidade,
            embarcacao_local: updatedValues.embarcacaoLocal,
            heat_map: updatedValues.heatMap,
            status_proposta: updatedValues.statusProposta,
            motivo_perda: updatedValues.motivoDeclinioPerda,
            pt_financeiro: updatedValues.pt,
            pc_ptc: updatedValues.pcPtc,
            cliente: updatedValues.empresa,
            uf: updatedValues.uf,
            solicitante: updatedValues.solicitante,
            email_solicitante: updatedValues.emailSolicitante,
            telefone_solicitante: updatedValues.telefoneSolicitante,
            po: updatedValues.po,
            rfi: updatedValues.rfi,
            fonte_lead: updatedValues.fonteLead,
            segmento_cliente: updatedValues.segmentoCliente,
            comentario: updatedValues.comentario,
            history_entry: {
                usuario: updatedValues.responsavel || proposal.responsavel,
                acao: "Dados comerciais atualizados",
                detalhe: "Campos comerciais e de controle foram atualizados no painel."
            }
        }).then(() => {
            state.dataEditMode = false;
            state.saveProposalError = false;
            renderProposalPanel();
            showNotification({
                type: "success",
                title: "Alterações salvas com sucesso",
                message: "Os dados comerciais da proposta foram atualizados."
            });
            showBottomToast("Dados atualizados há poucos segundos");
        }).catch((error) => {
            state.saveProposalError = true;
            renderProposalPanel();
            showNotification({
                type: "warning",
                title: "Erro ao salvar",
                message: Object.values(error.details || {}).join(" ") || error.message || "Não foi possível atualizar os dados comerciais da proposta."
            });
        });
    }

    function saveScopeData() {
        const proposal = getSelectedProposal();
        if (!proposal) {
            return;
        }

        if (state.saveProposalError) {
            showSaveProposalError();
            return;
        }

        const escopos = (state.scopeDraftServices || [])
            .map((service) => String(service || "").trim())
            .filter(Boolean);
        const estimativaReceita = refs.proposalDrawer.querySelector("#scopeReceita")?.value.trim() || proposal.estimativaReceita;
        const tempoContrato = refs.proposalDrawer.querySelector("#scopeTempo")?.value.trim() || proposal.tempoContratoDias;

        if (!escopos.length) {
            state.saveProposalError = true;
            renderProposalPanel();
            showNotification({
                type: "warning",
                title: "Atenção",
                message: "Selecione pelo menos um serviço/escopo para salvar."
            });
            return;
        }

        const escopo = escopos.join(" | ");
        const campos = buildScopeDraftItemsPayload();

        persistProposalUpdate(proposal.id, {
            servico: escopo,
            estimativo_receita: estimativaReceita,
            tempo_contrato_dias: tempoContrato,
            campos,
            history_entry: {
                usuario: proposal.responsavel,
                acao: "Escopo atualizado",
                detalhe: "Escopos, itens, receita estimada e tempo de contrato foram atualizados."
            }
        }).then(() => {
            state.scopeEditMode = false;
            state.saveProposalError = false;
            state.scopeDraftServices = [];
            state.scopeDraftItems = [];
            state.scopeQuickItemOpen = false;
            renderProposalPanel();
            showNotification({
                type: "success",
                title: "Alterações salvas com sucesso",
                message: "Escopos e valores da proposta foram atualizados."
            });
            showBottomToast("Dados atualizados há poucos segundos");
        }).catch((error) => {
            state.saveProposalError = true;
            renderProposalPanel();
            showNotification({
                type: "warning",
                title: "Erro ao salvar",
                message: error.message || "Não foi possível atualizar escopo e valores da proposta."
            });
        });
    }

    function saveFollowup() {
        const proposal = getSelectedProposal();
        if (!proposal) {
            return;
        }

        const payload = {
            data: refs.proposalDrawer.querySelector("#followupData")?.value.trim(),
            hora: refs.proposalDrawer.querySelector("#followupHora")?.value.trim(),
            responsavel: refs.proposalDrawer.querySelector("#followupResponsavel")?.value.trim(),
            tipoContato: refs.proposalDrawer.querySelector("#followupTipo")?.value.trim(),
            comentario: refs.proposalDrawer.querySelector("#followupComentario")?.value.trim(),
            proximaAcao: refs.proposalDrawer.querySelector("#followupAcao")?.value.trim(),
            dataProximaAcao: refs.proposalDrawer.querySelector("#followupDataAcao")?.value.trim(),
            status: refs.proposalDrawer.querySelector("#followupStatus")?.value.trim()
        };

        if (!payload.data || !payload.comentario || !payload.status) {
            showNotification({
                type: "warning",
                title: "Atenção",
                message: "Preencha data, atualização e status do acompanhamento."
            });
            return;
        }

        persistProposalUpdate(proposal.id, {
            followup_item: payload,
            follow_up: payload.proximaAcao || payload.comentario,
            previsao_contratacao: payload.dataProximaAcao || proposal.previsaoContratacao,
            history_entry: {
                usuario: payload.responsavel || proposal.responsavel,
                acao: "Acompanhamento registrado",
                detalhe: `${payload.tipoContato} registrado por ${payload.responsavel || proposal.responsavel}.`
            }
        }).then(() => {
            state.followupFormOpen = false;
            state.activeDetailTab = "followups";
            renderProposalPanel();
            showNotification({
                type: "success",
                title: "Acompanhamento registrado",
                message: "Histórico comercial atualizado."
            });
            showBottomToast("Dados atualizados há poucos segundos");
        }).catch((error) => {
            showNotification({
                type: "warning",
                title: "Erro ao salvar",
                message: error.message || "Não foi possível registrar o acompanhamento."
            });
        });
    }

    function saveQuickNote() {
        const proposal = getSelectedProposal();
        if (!proposal) {
            return;
        }

        const value = refs.proposalDrawer.querySelector("#panelQuickNote")?.value.trim();
        persistProposalUpdate(proposal.id, {
            comentario: value || proposal.comentario,
            history_entry: {
                usuario: proposal.responsavel,
                acao: "Comentário atualizado",
                detalhe: "Notas rápidas da proposta foram ajustadas."
            }
        }).then(() => {
            state.noteEditMode = false;
            renderProposalPanel();
            showNotification({
                type: "success",
                title: "Alterações salvas com sucesso",
                message: "As notas rápidas da proposta foram atualizadas."
            });
            showBottomToast("Dados atualizados há poucos segundos");
        }).catch((error) => {
            showNotification({
                type: "warning",
                title: "Erro ao salvar",
                message: error.message || "Não foi possível atualizar as notas rápidas da proposta."
            });
        });
    }

    function createNewRevision() {
        const proposal = getSelectedProposal();
        if (!proposal) {
            return;
        }

        const nextRevision = String(Number(proposal.rev || "0") + 1).padStart(2, "0");
        persistProposalUpdate(proposal.id, {
            revisao: nextRevision,
            history_entry: {
                usuario: proposal.responsavel,
                acao: "Revisão criada",
                detalhe: `Nova revisão gerada: REV ${nextRevision}.`
            }
        }).then((updatedProposal) => {
            renderProposalPanel();
            showNotification({
                type: "success",
                title: "Nova revisão criada",
                message: `A proposta agora está na REV ${updatedProposal.rev || nextRevision}.`
            });
            showBottomToast("Dados atualizados há poucos segundos");
        }).catch((error) => {
            showNotification({
                type: "warning",
                title: "Erro ao salvar",
                message: error.message || "Não foi possível criar a nova revisão."
            });
        });
    }

    async function saveStatusChange() {
        const proposal = getSelectedProposal();
        if (!proposal) {
            return;
        }

        const nextStatus = refs.proposalDrawer.querySelector("#panelStatusSelect")?.value || proposal.statusProposta;
        const reason = refs.proposalDrawer.querySelector("#panelReasonSelect")?.value || "";
        const needsReason = REASON_REQUIRED_STATUSES.has(nextStatus);

        if (needsReason && (!reason || reason === "Selecione o motivo")) {
            state.statusError = true;
            updateStatusReasonState();
            showNotification({
                type: "warning",
                title: "Atenção",
                message: "Existem campos obrigatórios pendentes."
            });
            return;
        }

        const endpoint = buildEndpoint(state.endpoints.statusPattern, proposal.id);
        if (!endpoint) {
            return;
        }

        try {
            const payload = await fetchJson(endpoint, {
                method: "POST",
                body: JSON.stringify({
                    status_proposta: nextStatus,
                    motivo_perda: needsReason ? reason : ""
                })
            });

            const updatedProposal = upsertProposal(payload?.proposal || {
                ...proposal,
                statusProposta: nextStatus,
                kanbanStage: normalizeKanbanStage(nextStatus),
                motivoDeclinioPerda: needsReason ? reason : ""
            });

            state.statusError = false;
            renderAll();
            renderProposalPanel();
            showNotification({
                type: "success",
                title: "Alterações salvas com sucesso",
                message: "O status da proposta foi atualizado."
            });
            showBottomToast("Dados atualizados há poucos segundos");
        } catch (error) {
            showNotification({
                type: "warning",
                title: "Erro ao salvar",
                message: error.message || "Não foi possível atualizar o status da proposta."
            });
        }
    }

    function updateStatusReasonState() {
        const statusField = refs.proposalDrawer.querySelector("#panelStatusSelect");
        const reasonField = refs.proposalDrawer.querySelector("#statusReasonField");
        if (!statusField || !reasonField) {
            return;
        }
        const required = REASON_REQUIRED_STATUSES.has(statusField.value);
        reasonField.classList.toggle("is-required", required);
        reasonField.classList.toggle("has-error", required && state.statusError);
    }

    function getSelectedProposal() {
        return proposals.find((proposal) => proposal.id === state.selectedProposalId) || null;
    }

    function getFilteredProposalsByColumn(statusKey) {
        return getVisibleProposals().filter((proposal) => proposal.kanbanStage === statusKey);
    }

    function getStageMeta(statusKey) {
        const stage = COLUMN_DEFINITIONS.find((item) => item.key === statusKey);
        return stage || { label: "Sem fase mapeada", icon: "assignment", description: "Status não mapeado" };
    }

    function renderKpiFilterNotice() {
        if (!state.kpiFilter) {
            refs.kpiFilterNotice.classList.add("is-hidden");
            refs.kpiFilterNotice.innerHTML = "";
            return;
        }

        const config = getKpiFilterConfig(state.kpiFilter);
        refs.kpiFilterNotice.classList.remove("is-hidden");
        refs.kpiFilterNotice.innerHTML = `
            <div class="kpi-filter-notice__copy">
                <span>${config.noticeLabel}</span>
                <span class="kpi-filter-notice__badge ${config.badgeClass || ""}">${config.noticeValue}</span>
            </div>
            <button class="kpi-filter-notice__clear" data-clear-kpi-filter type="button">${config.clearLabel}</button>
        `;
    }

    function applyKpiFilter(filterType) {
        if (!filterType || filterType === "all") {
            clearKpiFilter();
            return;
        }

        state.kpiFilter = filterType;
        state.focusedStage = "";
        state.focusedPage = 1;
        renderKpis();
        renderKpiFilterNotice();
        const config = getKpiFilterConfig(filterType);
        showNotification({
            type: "info",
            title: config.noticeLabel.includes("Ordenação") ? "Ordenação aplicada" : "Filtro aplicado",
            message: config.noticeLabel.includes("Ordenação")
                ? `Exibindo propostas ordenadas por ${config.noticeValue.toLowerCase()}.`
                : `Exibindo apenas ${config.noticeValue.toLowerCase()}.`
        });
        animatePipelineTransition();
    }

    function clearKpiFilter() {
        state.kpiFilter = "";
        state.focusedPage = 1;
        renderKpis();
        renderKpiFilterNotice();
        animatePipelineTransition();
    }

    function animatePipelineTransition() {
        refs.pipelineBoard.classList.add("kanban-filtering");
        refs.pipelineBoard.classList.remove("kanban-filtered");
        window.clearTimeout(state.pipelineTransitionTimer);
        state.pipelineTransitionTimer = window.setTimeout(() => {
            renderPipeline();
            refs.pipelineBoard.classList.remove("kanban-filtering");
            refs.pipelineBoard.classList.add("kanban-filtered");
            window.setTimeout(() => {
                refs.pipelineBoard.classList.remove("kanban-filtered");
            }, 220);
        }, 180);
    }

    function getKpiCardMeta(kpi) {
        if (kpi.filterType) {
            return { filterType: kpi.filterType };
        }

        const metaByTitle = {
            "Total de Propostas": { filterType: "all" },
            "Propostas no Mês": { filterType: "propostas-mes" },
            "Aguardando Aprovação": { filterType: "aguardando-aprovacao" },
            "Contratadas": { filterType: "contratadas" },
            "Canceladas": { filterType: "canceladas" }
        };

        return metaByTitle[kpi.title] || null;
    }

    function getKpiFilterConfig(filterType) {
        const configByType = {
            "propostas-mes": {
                noticeLabel: "Filtro ativo:",
                noticeValue: "Propostas no Mês",
                clearLabel: "Limpar filtro",
                focusedTitle: "Propostas no Mês",
                focusedSubtitle: "Filtro aplicado a partir do indicador",
                icon: "calendar_month",
                footerText: (count) => `Mostrando ${count} propostas emitidas no mês atual`
            },
            "aguardando-aprovacao": {
                noticeLabel: "Filtro ativo:",
                noticeValue: "Aguardando Aprovação",
                clearLabel: "Limpar filtro",
                focusedTitle: "Propostas Aguardando Aprovação",
                focusedSubtitle: "Filtro aplicado a partir do indicador",
                icon: "approval"
            },
            "contratadas": {
                noticeLabel: "Filtro ativo:",
                noticeValue: "Contratadas",
                clearLabel: "Limpar filtro",
                focusedTitle: "Propostas Contratadas",
                focusedSubtitle: "Filtro aplicado a partir do indicador",
                icon: "task_alt"
            },
            "canceladas": {
                noticeLabel: "Filtro ativo:",
                noticeValue: "Canceladas",
                clearLabel: "Limpar filtro",
                focusedTitle: "Propostas Canceladas",
                focusedSubtitle: "Filtro aplicado a partir do indicador",
                icon: "cancel"
            }
        };

        return configByType[filterType] || {
            noticeLabel: "Filtro ativo:",
            noticeValue: "Total de Propostas",
            clearLabel: "Limpar filtro",
            focusedTitle: "Todas as Propostas",
            focusedSubtitle: "Visualização completa do pipeline",
            icon: "view_kanban"
        };
    }

    function getVisibleProposals() {
        return proposals.filter((proposal) => {
            const haystack = `${proposal.numeroProposta} ${proposal.empresa} ${proposal.unidade} ${proposal.responsavel} ${proposal.statusProposta} ${proposal.tipoOperacao}`.toLowerCase();
            return (!state.search || haystack.includes(state.search))
                && (!state.filterNumero || String(proposal.numeroProposta || "").toLowerCase().includes(state.filterNumero))
                && (!state.filterStatus || proposal.kanbanStage === state.filterStatus)
                && (!state.filterNatureza || proposal.natureza === state.filterNatureza)
                && (!state.filterStatusProposta || proposal.statusProposta === state.filterStatusProposta)
                && (!state.filterTipoOperacao || proposal.tipoOperacao === state.filterTipoOperacao)
                && (!state.filterResponsavel || proposal.responsavel === state.filterResponsavel)
                && (!state.filterCliente || proposal.empresa.toLowerCase().includes(state.filterCliente))
                && (!state.filterUnidade || String(proposal.unidade || "").toLowerCase().includes(state.filterUnidade))
                && (!state.filterUf || proposal.uf === state.filterUf)
                && (!state.filterSegmentoCliente || proposal.segmentoCliente === state.filterSegmentoCliente)
                && (!state.filterFonteLead || proposal.fonteLead === state.filterFonteLead)
                && (!state.filterHeatMap || proposal.heatMap === state.filterHeatMap)
                && (!state.filterMotivoPerda || proposal.motivoDeclinioPerda === state.filterMotivoPerda)
                && (!state.filterPrazo
                    || (state.filterPrazo === "atrasada" && proposal.atrasada)
                    || (state.filterPrazo === "em_dia" && !proposal.atrasada));
        });
    }

    function getKpiFilteredProposals(filterType) {
        const visible = getVisibleProposals();

        if (filterType === "contratadas") {
            return visible.filter((proposal) => proposal.kanbanStage === "contratadas");
        }

        if (filterType === "canceladas") {
            return visible.filter((proposal) => proposal.kanbanStage === "canceladas");
        }

        if (filterType === "propostas-mes") {
            const today = new Date(state.todayIso || new Date().toISOString());
            return visible.filter((proposal) => {
                const emission = parseBrazilianDate(proposal.emissao);
                return emission && emission.getFullYear() === today.getFullYear() && emission.getMonth() === today.getMonth();
            });
        }

        if (filterType === "aguardando-aprovacao") {
            return visible.filter((proposal) => ["aguardando aprovacao gestores", "aguardando aprovacao dos gestores"].includes(normalizeString(proposal.statusProposta)));
        }

        return visible;
    }

    function isProposalLate(proposal) {
        const status = normalizeStatusDisplay(proposal.statusProposta || proposal.kanbanStage || "");
        if (["Fechada/Contratada", "Perdida/Recusada", "Cancelada", "Declínio", "Contratada"].includes(status)) {
            return false;
        }

        if (proposal.atrasada) {
            return true;
        }

        const deliveryDate = parseBrazilianDate(proposal.dataEntregaProposta);
        const mockToday = state.todayIso ? new Date(`${state.todayIso}T00:00:00`) : new Date();
        return Boolean(deliveryDate && deliveryDate < mockToday);
    }

    function parseBrazilianDate(value) {
        if (!value || !value.includes("/")) {
            return null;
        }

        const [day, month, year] = value.split("/").map(Number);
        if (!day || !month || !year) {
            return null;
        }

        return new Date(year, month - 1, day);
    }

    function buildDefaultAgendaPeriod(todayIso) {
        const reference = todayIso ? new Date(`${todayIso}T00:00:00`) : new Date();
        const year = reference.getFullYear();
        const month = reference.getMonth();
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 0);
        return `${start.toISOString().slice(0, 10)}|${end.toISOString().slice(0, 10)}`;
    }

    function parseCurrencyValue(value) {
        if (typeof value === "number") {
            return value;
        }
        return Number(String(value || "0").replace(/[^\d,]/g, "").replace(/\./g, "").replace(",", ".")) || 0;
    }

    function normalizeCurrencyToDecimal(value) {
        return parseCurrencyValue(value).toFixed(2);
    }

    function formatCurrencyDisplay(value) {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL"
        }).format(Number(value) || 0);
    }

    function formatCurrencyInputValue(value) {
        const numericValue = Number(value) || 0;
        return numericValue.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function formatCurrencyTyping(value, withSymbol = false) {
        const digits = String(value || "").replace(/\D/g, "");
        if (!digits) {
            return "";
        }

        const amount = Number(digits) / 100;
        return withSymbol ? formatCurrencyDisplay(amount) : formatCurrencyInputValue(amount);
    }

    function buildAgendaFollowups() {
        const proposalBased = proposals.flatMap((proposal) => proposal.followUps.map((item, index) => ({
            id: Number(`${proposal.id}${index + 1}`),
            numeroProposta: proposal.numeroProposta,
            cliente: proposal.empresa,
            natureza: proposal.natureza,
            data: normalizeDate(item.dataProximaAcao || item.data),
            hora: item.hora || "09:00",
            responsavel: item.responsavel,
            tipoContato: item.tipoContato,
            assunto: item.proximaAcao || item.comentario,
            proximaAcao: item.proximaAcao || item.comentario,
            status: item.status
        })));

        const extras = [
            ["PRO-2026-015", "Modec do Brasil", "Onshore", "2026-07-10", "14:30", "Camila Souza", "Ligação", "Alinhar condições comerciais", "Alinhar retorno com suprimentos", "Pendente"],
            ["PRO-2026-020", "Equinor Brasil", "Offshore", "2026-07-11", "16:00", "Rafael Lima", "E-mail", "Enviar minuta do contrato", "Aguardar validação jurídica", "Pendente"],
            ["PRO-2026-017", "Shell Brasil", "Offshore", "2026-07-13", "09:00", "Camila Souza", "Reunião", "Apresentar proposta final", "Preparar versão revisada", "Pendente"],
            ["PRO-2026-018", "Brava Energia", "Offshore", "2026-07-13", "11:00", "Juliana Costa", "WhatsApp", "Validar janela de mobilização", "Consolidar planejamento", "Pendente"],
            ["PRO-2026-021", "Petrogal Brasil", "Onshore", "2026-07-14", "08:30", "Rafael Lima", "Ligação", "Retomar negociação comercial", "Enviar proposta revisada", "Pendente"],
            ["PRO-2026-022", "Transocean", "Offshore", "2026-07-14", "15:00", "Beatriz Nunes", "Reunião", "Detalhar escopo operacional", "Revisar escopo interno", "Reagendado"],
            ["PRO-2026-023", "3R Petroleum", "Onshore", "2026-07-15", "10:30", "Lucas Freitas", "E-mail", "Compartilhar apresentação executiva", "Aguardar feedback", "Pendente"],
            ["PRO-2026-024", "PRIO Brasil", "Offshore", "2026-07-15", "14:00", "Rafael Lima", "Ligação", "Discutir cronograma de bordo", "Confirmar recursos", "Pendente"],
            ["PRO-2026-025", "Enauta", "Onshore", "2026-07-16", "09:15", "Carla Mendes", "WhatsApp", "Reforçar prazo de resposta", "Acompanhar aprovação", "Sem retorno"],
            ["PRO-2026-026", "Subsea 7", "Offshore", "2026-07-16", "16:45", "Juliana Costa", "Ligação", "Avaliar condições de contrato", "Validar ponto a ponto", "Pendente"],
            ["PRO-2026-027", "Baker Hughes", "Onshore", "2026-07-17", "11:20", "Marcos Silva", "E-mail", "Encaminhar composição de equipe", "Esperar retorno", "Pendente"],
            ["PRO-2026-028", "Chevron Brasil", "Offshore", "2026-07-17", "17:10", "Rafael Lima", "Reunião", "Ajustar premissas financeiras", "Preparar versão final", "Pendente"],
            ["PRO-2026-029", "SLB", "Offshore", "2026-07-18", "09:30", "Beatriz Nunes", "E-mail", "Compartilhar anexo técnico", "Aguardar aprovação", "Realizado"],
            ["PRO-2026-030", "TotalEnergies", "Onshore", "2026-07-19", "13:40", "Lucas Freitas", "Ligação", "Confirmar data de visita", "Agendar equipe", "Pendente"],
            ["PRO-2026-031", "PetroReconcavo", "Onshore", "2026-07-21", "10:10", "Carla Mendes", "WhatsApp", "Enviar versão simplificada", "Retornar após leitura", "Pendente"],
            ["PRO-2026-032", "OceanPact", "Offshore", "2026-07-22", "15:50", "Juliana Costa", "Reunião", "Apresentar custos adicionais", "Avaliar impactos", "Reagendado"],
            ["PRO-2026-033", "Acelen", "Onshore", "2026-07-23", "08:50", "Rafael Lima", "Ligação", "Revisar prazo contratual", "Esperar contraproposta", "Pendente"],
            ["PRO-2026-034", "Ibmec Energia", "Onshore", "2026-07-24", "14:20", "Marcos Silva", "E-mail", "Formalizar follow-up comercial", "Acompanhar com cliente", "Pendente"],
            ["PRO-2026-035", "Seatrium", "Offshore", "2026-07-25", "11:35", "Camila Souza", "Reunião", "Ajustar proposta offshore", "Alinhar próximo encontro", "Pendente"],
            ["PRO-2026-036", "Cosan Lubrificantes", "Onshore", "2026-07-28", "16:10", "Rafael Lima", "Ligação", "Confirmar recebimento da proposta", "Reforçar diferenciais", "Sem retorno"],
            ["PRO-2026-037", "Modec do Brasil", "Offshore", "2026-07-29", "09:45", "Rafael Lima", "Ligação", "Revisar cronograma embarcado", "Atualizar equipe técnica", "Pendente"],
            ["PRO-2026-038", "Equinor Brasil", "Offshore", "2026-07-30", "15:15", "Rafael Lima", "Reunião", "Concluir alinhamento comercial", "Enviar ata consolidada", "Pendente"],
            ["PRO-2026-039", "Shell Brasil", "Onshore", "2026-07-31", "11:05", "Carla Mendes", "E-mail", "Conferir documentação final", "Aguardar aceite", "Pendente"]
        ].map((item, index) => ({
            id: 1000 + index,
            numeroProposta: item[0],
            cliente: item[1],
            natureza: item[2],
            data: item[3],
            hora: item[4],
            responsavel: item[5],
            tipoContato: item[6],
            assunto: item[7],
            proximaAcao: item[8],
            status: item[9]
        }));

        return [...proposalBased, ...extras].sort((a, b) => {
            const aKey = `${a.data} ${a.hora}`;
            const bKey = `${b.data} ${b.hora}`;
            return aKey.localeCompare(bKey);
        });
    }

    function buildAgendaFollowups() {
        return proposals.flatMap((proposal) => proposal.followUps.map((item, index) => ({
            id: Number(`${proposal.id}${index + 1}`),
            numeroProposta: proposal.numeroProposta,
            cliente: proposal.empresa,
            natureza: proposal.natureza,
            data: normalizeDate(item.dataProximaAcao || item.data),
            hora: item.hora || "09:00",
            responsavel: item.responsavel,
            tipoContato: item.tipoContato,
            assunto: item.proximaAcao || item.comentario,
            proximaAcao: item.proximaAcao || item.comentario,
            status: item.status
        }))).sort((a, b) => {
            const aKey = `${a.data} ${a.hora}`;
            const bKey = `${b.data} ${b.hora}`;
            return aKey.localeCompare(bKey);
        });
    }

    function getAgendaFilteredItems({ includeDayFocus = true } = {}) {
        const [startDate, endDate] = parseAgendaPeriod(state.agendaPeriod);
        return agendaFollowups.filter((item) => {
            const searchHaystack = `${item.numeroProposta} ${item.cliente} ${item.assunto}`.toLowerCase();
            return (!state.agendaSearch || searchHaystack.includes(state.agendaSearch))
                && (!startDate || item.data >= startDate)
                && (!endDate || item.data <= endDate)
                && (state.agendaResponsavel === "Todos" || item.responsavel === state.agendaResponsavel)
                && (state.agendaStatus === "Todos" || item.status === state.agendaStatus)
                && (!includeDayFocus || !state.agendaDayFocus || item.data === state.agendaDayFocus);
        });
    }

    function getAgendaPagedItems() {
        const items = getAgendaFilteredItems();
        const total = items.length;
        const totalPages = Math.max(1, Math.ceil(total / state.agendaPerPage));
        state.agendaPage = Math.min(state.agendaPage, totalPages);
        const startIndex = (state.agendaPage - 1) * state.agendaPerPage;
        const paged = items.slice(startIndex, startIndex + state.agendaPerPage);
        return {
            items: paged,
            total,
            totalPages,
            start: total ? startIndex + 1 : 0,
            end: total ? startIndex + paged.length : 0
        };
    }

    function getAgendaTotalPages() {
        return Math.max(1, Math.ceil(getAgendaFilteredItems().length / state.agendaPerPage));
    }

    function groupAgendaItemsByDate(items) {
        const groups = new Map();
        items.forEach((item) => {
            if (!groups.has(item.data)) {
                groups.set(item.data, []);
            }
            groups.get(item.data).push(item);
        });
        return [...groups.entries()].map(([date, entries]) => ({ date, entries }));
    }

    function renderAgendaGroup(group) {
        return `
            <section class="agenda-group">
                <div class="agenda-group__header">
                    <div class="agenda-group__title">
                        <span class="material-icons" aria-hidden="true">calendar_today</span>
                        <h4>${escapeHtml(formatAgendaGroupDate(group.date))}</h4>
                    </div>
                    <span>${group.entries.length} follow-ups</span>
                </div>
                <div class="agenda-group__items">
                    ${group.entries.map((item) => `
                        <article class="agenda-item">
                            <div class="agenda-item__date">
                                <strong>${escapeHtml(formatAgendaDay(item.data))}</strong>
                                <span>${escapeHtml(formatAgendaMonthShort(item.data))}</span>
                            </div>
                            <div class="agenda-item__time">${escapeHtml(item.hora)}</div>
                            <div class="agenda-item__content">
                                <span class="agenda-item__proposal">${escapeHtml(item.numeroProposta)}</span>
                                <strong>${escapeHtml(item.cliente)}</strong>
                                <p>${escapeHtml(item.assunto)}</p>
                            </div>
                            <div class="agenda-item__owner">${escapeHtml(item.responsavel)}</div>
                            <div class="agenda-item__contact">
                                <span class="material-icons" aria-hidden="true">${item.tipoContato === "Ligação" ? "call" : "contact_phone"}</span>
                            </div>
                            <div class="agenda-item__status">
                                <span class="agenda-status-badge ${slugify(item.status)}">${escapeHtml(item.status)}</span>
                            </div>
                        </article>
                    `).join("")}
                </div>
            </section>
        `;
    }

    function renderAgendaSummaryCard(icon, label, value, meta) {
        return `
            <article class="agenda-summary-card">
                <span class="agenda-summary-card__icon">
                    <span class="material-icons" aria-hidden="true">${icon}</span>
                </span>
                <div class="agenda-summary-card__content">
                    <span class="agenda-summary-card__label">${label}</span>
                    <strong class="agenda-summary-card__value">${value}</strong>
                    <span class="agenda-summary-card__meta">${meta}</span>
                </div>
            </article>
        `;
    }

    function getAgendaSummary(items) {
        const today = items.filter((item) => item.data === "2026-07-10").length;
        const week = items.filter((item) => item.data >= "2026-07-10" && item.data <= "2026-07-16").length;
        const pending = items.filter((item) => item.status === "Pendente").length;
        const ownerCounts = items.reduce((accumulator, item) => {
            accumulator[item.responsavel] = (accumulator[item.responsavel] || 0) + 1;
            return accumulator;
        }, {});
        const topOwnerEntry = Object.entries(ownerCounts).sort((a, b) => b[1] - a[1])[0] || ["Rafael Lima", 0];

        return {
            today,
            week,
            pending,
            topOwner: { name: topOwnerEntry[0], count: topOwnerEntry[1] }
        };
    }

    function renderAgendaCalendar(items) {
        const datesWithItems = new Set(items.map((item) => item.data));
        const days = [];
        const firstDayIndex = 3;
        const totalDays = 31;
        const prevMonthDays = [28, 29, 30];

        prevMonthDays.forEach((day) => {
            days.push(`<span class="agenda-calendar__day is-muted">${day}</span>`);
        });

        for (let day = 1; day <= totalDays; day += 1) {
            const iso = `2026-07-${String(day).padStart(2, "0")}`;
            const hasItem = datesWithItems.has(iso);
            const isSelected = state.agendaSelectedDate === iso;
            days.push(`
                <button class="agenda-calendar__day ${isSelected ? "is-selected" : ""}" data-agenda-action="select-day" data-date="${iso}" type="button">
                    <span>${day}</span>
                    ${hasItem ? `<i class="agenda-calendar__dot" aria-hidden="true"></i>` : ""}
                </button>
            `);
        }

        while (days.length < 35) {
            days.push(`<span class="agenda-calendar__day is-muted">${days.length - (firstDayIndex + totalDays) + 1}</span>`);
        }

        return `
            <div class="agenda-calendar">
                <div class="agenda-calendar__weekdays">
                    ${["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"].map((day) => `<span>${day}</span>`).join("")}
                </div>
                <div class="agenda-calendar__grid">
                    ${days.join("")}
                </div>
            </div>
        `;
    }

    function getAgendaDayItems(date, baseItems = agendaFollowups) {
        return baseItems.filter((item) => item.data === date).sort((a, b) => a.hora.localeCompare(b.hora));
    }

    function renderAgendaPageButtons(totalPages) {
        return Array.from({ length: totalPages }, (_, index) => {
            const page = index + 1;
            return `
                <button class="agenda-page-btn ${page === state.agendaPage ? "is-active" : ""}" data-agenda-action="go-page" data-page="${page}" type="button">
                    ${page}
                </button>
            `;
        }).join("");
    }

    function parseAgendaPeriod(value) {
        if (!value) {
            return ["", ""];
        }

        if (value.includes("|")) {
            return value.split("|");
        }

        const normalized = value.replace(/\s+/g, "");
        const parts = normalized.split("–");
        if (parts.length === 2) {
            return [normalizeDate(parts[0]), normalizeDate(parts[1])];
        }

        return ["2026-07-10", "2026-07-31"];
    }

    function formatAgendaPeriodLabel(value) {
        const [start, end] = parseAgendaPeriod(value);
        return `${formatDateBr(start)} – ${formatDateBr(end)}`;
    }

    function formatAgendaGroupDate(isoDate) {
        const names = {
            "2026-07-10": "Sexta-feira, 10 de julho de 2026",
            "2026-07-11": "Sábado, 11 de julho de 2026",
            "2026-07-12": "Domingo, 12 de julho de 2026",
            "2026-07-13": "Segunda-feira, 13 de julho de 2026",
            "2026-07-14": "Terça-feira, 14 de julho de 2026",
            "2026-07-15": "Quarta-feira, 15 de julho de 2026",
            "2026-07-16": "Quinta-feira, 16 de julho de 2026",
            "2026-07-17": "Sexta-feira, 17 de julho de 2026",
            "2026-07-18": "Sábado, 18 de julho de 2026",
            "2026-07-19": "Domingo, 19 de julho de 2026",
            "2026-07-21": "Terça-feira, 21 de julho de 2026",
            "2026-07-22": "Quarta-feira, 22 de julho de 2026",
            "2026-07-23": "Quinta-feira, 23 de julho de 2026",
            "2026-07-24": "Sexta-feira, 24 de julho de 2026",
            "2026-07-25": "Sábado, 25 de julho de 2026",
            "2026-07-28": "Terça-feira, 28 de julho de 2026"
        };
        return names[isoDate] || formatDateBr(isoDate);
    }

    function formatAgendaSummaryDay(isoDate) {
        const label = formatAgendaGroupDate(isoDate);
        return label.replace(" de 2026", "");
    }

    function formatDateBr(isoDate) {
        if (!isoDate) {
            return "";
        }
        const [year, month, day] = isoDate.split("-");
        return `${day}/${month}/${year}`;
    }

    function formatAgendaDay(isoDate) {
        return isoDate.split("-")[2];
    }

    function formatAgendaMonthShort(isoDate) {
        const months = { "07": "JUL" };
        return months[isoDate.split("-")[1]] || "";
    }

    function getNextAction(proposal) {
        const followups = [...proposal.followUps].sort((a, b) => compareDates(a.dataProximaAcao || a.data, b.dataProximaAcao || b.data));
        return followups[0] || {};
    }

    function addHistory(proposal, acao, detalhe) {
        proposal.historico.unshift({
            dataHora: `${todayDate()} ${currentTime()}`,
            usuario: proposal.responsavel,
            acao,
            detalhe
        });
    }

    function createProposal(id, data) {
        return {
            id,
            followUps: data.followUps || [],
            historico: data.historico || [],
            atrasada: Boolean(data.atrasada),
            ...data
        };
    }

    function renderPanelTab(key, label) {
        return `
            <button class="proposal-panel__tab ${state.activeDetailTab === key ? "is-active" : ""}" data-panel-tab="${key}" type="button">
                ${label}
            </button>
        `;
    }

    function renderSummaryItem(icon, label, value) {
        return `
            <article class="summary-item">
                <span class="material-icons" aria-hidden="true">${icon}</span>
                <div class="summary-item__content">
                    <span class="summary-item__label">${escapeHtml(label)}</span>
                    <strong class="summary-item__value">${escapeHtml(value || "Não informado")}</strong>
                </div>
            </article>
        `;
    }

    function renderCompactItem(label, value) {
        return `
            <div class="compact-item">
                <span class="compact-item__label">${escapeHtml(label)}</span>
                <strong class="compact-item__value">${escapeHtml(value || "Não informado")}</strong>
            </div>
        `;
    }

    function renderDataGroup(title, fields, modifierClass = "") {
        return `
            <section class="detail-group ${modifierClass}">
                <h4>${title}</h4>
                <div class="detail-group__grid">
                    ${fields.join("")}
                </div>
            </section>
        `;
    }

    function editableField(label, fieldName, value, editable, options = null, isTextarea = false, inputType = "text") {
        if (!state.dataEditMode || !editable) {
            return `
                <div class="value-field">
                    <span class="value-field__label">${escapeHtml(label)}</span>
                    <strong class="value-field__value">${escapeHtml(value || "Não informado")}</strong>
                </div>
            `;
        }

        if (isTextarea) {
            return `
                <div class="edit-field">
                    <label for="field_${fieldName}">${escapeHtml(label)}</label>
                    <textarea id="field_${fieldName}" data-edit-field="${fieldName}">${escapeHtml(value || "")}</textarea>
                </div>
            `;
        }

        if (Array.isArray(options)) {
            return renderSelectField(label, `field_${fieldName}`, value, options, fieldName);
        }

        return renderInputField(label, `field_${fieldName}`, value || "", false, fieldName, inputType);
    }

    function renderInputField(label, id, value, required = false, dataField = "", inputType = "text") {
        return `
            <div class="edit-field ${required ? "is-required" : ""}">
                <label for="${id}">${escapeHtml(label)}</label>
                <input id="${id}" type="${inputType}" value="${escapeHtml(value || "")}" ${dataField ? `data-edit-field="${dataField}"` : ""}>
            </div>
        `;
    }

    function renderSelectField(label, id, selected, options, dataField = "") {
        return `
            <div class="edit-field">
                <label for="${id}">${escapeHtml(label)}</label>
                <select id="${id}" ${dataField ? `data-edit-field="${dataField}"` : ""}>
                    ${renderOptions(options, selected)}
                </select>
            </div>
        `;
    }

    function renderOptions(options, selectedValue) {
        return options.map((option) => `
            <option value="${escapeHtml(option)}" ${option === selectedValue ? "selected" : ""}>${escapeHtml(option)}</option>
        `).join("");
    }

    function readFieldValues(fields) {
        return fields.reduce((accumulator, field) => {
            const input = refs.proposalDrawer.querySelector(`[data-edit-field="${field}"]`);
            accumulator[field] = input ? input.value.trim() : "";
            return accumulator;
        }, {});
    }

    function proposalStatusRequiresReason() {
        const status = document.getElementById("proposalStatus")?.value?.trim() || "";
        const normalizedStatus = status
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");

        return ["perdida/recusada", "cancelada", "declinio"].includes(normalizedStatus);
    }

    function proposalWillNotParticipate() {
        return state.criticalAnalysisAnswers?.iremos_participar === "NAO";
    }

    function validateNewProposalForm() {
        if (proposalWillNotParticipate()) {
            state.createProposalErrorFields = {};
            clearAllErrors();
            hideProposalModalAlert();
            return true;
        }

        const validations = {
            proposalRev: "Informe a revisão.",
            proposalEmissao: "Informe a emissão.",
            proposalResponsavel: "Selecione um responsável.",
            proposalNatureza: "Selecione a natureza.",
            proposalHeatMap: "Selecione o heat map.",
            proposalStatus: "Selecione o status da proposta.",
            proposalCliente: "Selecione um cliente.",
            proposalUnidade: "Selecione uma unidade.",
            proposalTipoOperacao: "Selecione o tipo de operação.",
            proposalServico: "Selecione o serviço.",
            proposalDataSolicitacao: "Informe a data de solicitação da proposta.",
            proposalDataEntrega: "Informe a data prevista.",
            proposalReceita: "Informe a estimativa de receita."
        };

        let isValid = true;
        state.createProposalErrorFields = {};

        Object.entries(validations).forEach(([fieldId, message]) => {
            const field = document.getElementById(fieldId);
            if (!field || field.value.trim()) {
                clearProposalFieldError(fieldId);
                return;
            }
            state.createProposalErrorFields[fieldId] = message;
            setProposalFieldError(fieldId, message);
            isValid = false;
        });

        const selectedServices = (state.proposalDraftServices || [])
            .map((item) => String(item || "").trim())
            .filter(Boolean);
        if (!selectedServices.length) {
            state.createProposalErrorFields.proposalServico = "Selecione pelo menos um serviço / escopo.";
            setProposalFieldError("proposalServico", "Selecione pelo menos um serviço / escopo.");
            isValid = false;
        } else {
            clearProposalFieldError("proposalServico");
        }

        if (proposalStatusRequiresReason()) {
            const reasonField = document.getElementById("proposalMotivo");
            if (!reasonField?.value.trim()) {
                state.createProposalErrorFields.proposalMotivo = "Informe o motivo de declínio/perda.";
                setProposalFieldError("proposalMotivo", "Informe o motivo de declínio/perda.");
                isValid = false;
            } else {
                clearProposalFieldError("proposalMotivo");
            }
        } else {
            clearProposalFieldError("proposalMotivo");
        }

        if (!validateProposalItems()) {
            isValid = false;
        }

        state.createProposalError = !isValid;
        if (!isValid) {
            renderProposalModalAlert();
        } else {
            hideProposalModalAlert();
        }
        return isValid;
    }

    function showCreateProposalError() {
        if (!refs.newProposalModal.classList.contains("is-open")) {
            openProposalModal();
        }
        state.createProposalError = true;
        state.modalStep = 2;
        updateModalStep();
        if (!Object.keys(state.createProposalErrorFields).length) {
            state.createProposalErrorFields = {
                proposalResponsavel: "Selecione um responsável.",
                proposalCliente: "Selecione um cliente.",
                proposalServico: "Selecione o serviço."
            };
        }
        renderProposalModalAlert();
        Object.entries(state.createProposalErrorFields).forEach(([fieldId, message]) => {
            setProposalFieldError(fieldId, message);
        });
    }

    function compareDates(dateA, dateB) {
        const normalizedA = normalizeDate(dateA);
        const normalizedB = normalizeDate(dateB);
        if (!normalizedA && !normalizedB) {
            return 0;
        }
        if (!normalizedA) {
            return 1;
        }
        if (!normalizedB) {
            return -1;
        }
        return normalizedA.localeCompare(normalizedB);
    }

    function normalizeDate(dateString) {
        if (!dateString || !dateString.includes("/")) {
            return "";
        }
        const [day, month, year] = dateString.split("/");
        return `${year}-${month}-${day}`;
    }

    function formatAgendaDate(dateString) {
        if (!dateString || !dateString.includes("/")) {
            return ["--", "---"];
        }
        const [day, month] = dateString.split("/");
        const monthMap = {
            "01": "JAN", "02": "FEV", "03": "MAR", "04": "ABR", "05": "MAI", "06": "JUN",
            "07": "JUL", "08": "AGO", "09": "SET", "10": "OUT", "11": "NOV", "12": "DEZ"
        };
        return [day, monthMap[month] || month];
    }

    function handleDelegatedClick(event) {
        const quickActionTrigger = event.target.closest("[data-quick-action]");
        if (quickActionTrigger && !refs.quickActionsList?.contains(quickActionTrigger)) {
            handleQuickActionClick(event);
            return;
        }

        const seeAllTrigger = event.target.closest("[data-see-all-stage]");
        if (seeAllTrigger) {
            openFocusedStageView(seeAllTrigger.dataset.seeAllStage);
            return;
        }

        const backToAllTrigger = event.target.closest("[data-back-all-stages]");
        if (backToAllTrigger) {
            if (state.kpiFilter) {
                clearKpiFilter();
            } else {
                state.focusedStage = "";
                state.focusedPage = 1;
                renderPipeline();
            }
            return;
        }

        const focusedPageTrigger = event.target.closest("[data-focused-page]");
        if (focusedPageTrigger) {
            const nextPage = Number(focusedPageTrigger.dataset.focusedPage);
            if (nextPage) {
                goToFilteredPage(nextPage);
            }
            return;
        }

        const proposalPdfTrigger = event.target.closest("[data-proposal-pdf]");
        if (proposalPdfTrigger) {
            event.preventDefault();
            event.stopImmediatePropagation();
            handleProposalPdfRequest(proposalPdfTrigger);
            return;
        }

        const proposalPdfMenuTrigger = event.target.closest("[data-proposal-pdf-menu]");
        if (proposalPdfMenuTrigger) {
            event.preventDefault();
            const menu = proposalPdfMenuTrigger.closest(".proposal-card__pdf-menu");
            const isOpen = menu?.classList.toggle("is-open");
            proposalPdfMenuTrigger.setAttribute("aria-expanded", String(Boolean(isOpen)));
            return;
        }

        const proposalTrigger = event.target.closest("[data-proposal-id]");
        if (proposalTrigger && !event.target.closest("[data-panel-action], [data-proposal-pdf], [data-proposal-pdf-menu]")) {
            openProposalPanel(Number(proposalTrigger.dataset.proposalId));
            return;
        }

        const agendaAction = event.target.closest("[data-agenda-action]");
        if (agendaAction) {
            const action = agendaAction.dataset.agendaAction;
            if (action === "close") {
                closeFullFollowupAgenda();
            } else if (action === "apply-filters") {
                applyFollowupAgendaFilters();
            } else if (action === "clear-filters") {
                clearFollowupAgendaFilters();
            } else if (action === "new-followup") {
                state.agendaCreateOpen = true;
                renderFollowupAgenda();
            } else if (action === "cancel-new-followup") {
                state.agendaCreateOpen = false;
                renderFollowupAgenda();
            } else if (action === "save-new-followup") {
                saveAgendaFollowup();
            } else if (action === "prev-page") {
                state.agendaPage = Math.max(1, state.agendaPage - 1);
                renderFollowupAgenda();
            } else if (action === "next-page") {
                state.agendaPage = Math.min(getAgendaTotalPages(), state.agendaPage + 1);
                renderFollowupAgenda();
            } else if (action === "go-page") {
                state.agendaPage = Number(agendaAction.dataset.page) || 1;
                renderFollowupAgenda();
            } else if (action === "select-day") {
                selectAgendaDay(agendaAction.dataset.date);
            } else if (action === "view-day") {
                state.agendaDayFocus = state.agendaSelectedDate;
                state.agendaPage = 1;
                renderFollowupAgenda();
            }
            return;
        }

        const closeTrigger = event.target.closest("[data-close-modal]");
        if (closeTrigger) {
            closeModal(document.getElementById(closeTrigger.dataset.closeModal));
            return;
        }

        const tabTrigger = event.target.closest("[data-panel-tab]");
        if (tabTrigger) {
            state.activeDetailTab = tabTrigger.dataset.panelTab;
            renderProposalPanel();
            return;
        }

        const actionTrigger = event.target.closest("[data-panel-action]");
        if (!actionTrigger) {
            if (event.target.closest("[data-retry-pipeline]")) {
                retryLoadPipeline();
                return;
            }
            if (event.target.closest("[data-reset-pipeline-error]")) {
                hidePipelineErrorState();
                return;
            }
            if (event.target.closest("[data-clear-commercial-filters]")) {
                clearComercialFilters();
                return;
            }
            if (event.target.closest("[data-focus-commercial-search]")) {
                focusComercialSearch();
                return;
            }
            if (event.target.closest("[data-proposal-item-add]")) {
                addProposalItemRow();
                return;
            }
            if (event.target.closest("#addProposalServiceRow")) {
                addProposalServiceRow();
                return;
            }
            const removeProposalServiceTrigger = event.target.closest("[data-proposal-service-remove]");
            if (removeProposalServiceTrigger) {
                removeProposalServiceRow(Number(removeProposalServiceTrigger.dataset.proposalServiceRemove));
                return;
            }
            if (event.target.closest("[data-retry-followups]")) {
                retryLoadFollowups();
                return;
            }
            if (event.target.closest("[data-recover-connection]")) {
                recoverConnectionState();
                return;
            }
            if (event.target.closest("[data-back-home]")) {
                window.location.href = "/";
                return;
            }
            if (event.target.closest("[data-proposal-error-review]")) {
                focusFirstProposalErrorField();
                return;
            }
            if (event.target.closest("[data-proposal-error-close]")) {
                closeProposalModal();
                return;
            }

            const stageFilterTrigger = event.target.closest("[data-stage-filter-toggle]");
            if (stageFilterTrigger) {
                state.filtersOpen = !state.filtersOpen;
                refs.filtersPanel.classList.toggle("is-hidden", !state.filtersOpen);
                return;
            }
            return;
        }

        if (actionTrigger.dataset.panelAction === "upload-documents") {
            refs.proposalDrawer.querySelector("[data-proposal-attachments-input]")?.click();
            return;
        }
        if (actionTrigger.dataset.panelAction === "delete-document") {
            deleteProposalDocument(actionTrigger.dataset.documentUrl, actionTrigger.dataset.documentId);
            return;
        }

        const action = actionTrigger.dataset.panelAction;
        if (action === "close-panel") {
            closeProposalPanel();
        } else if (action === "edit-data") {
            state.activeDetailTab = "dados";
            state.dataEditMode = true;
            state.saveProposalError = false;
            renderProposalPanel();
        } else if (action === "cancel-data") {
            state.saveProposalError = false;
            state.dataEditMode = false;
            renderProposalPanel();
        } else if (action === "save-data") {
            saveCommercialData();
        } else if (action === "edit-critical-analysis") {
            state.activeDetailTab = "analise-critica";
            state.dataEditMode = false;
            state.criticalAnalysisEditMode = true;
            state.saveProposalError = false;
            renderProposalPanel();
        } else if (action === "cancel-critical-analysis") {
            state.criticalAnalysisEditMode = false;
            state.saveProposalError = false;
            renderProposalPanel();
        } else if (action === "save-critical-analysis") {
            saveCriticalAnalysis();
        } else if (action === "edit-scope") {
            state.activeDetailTab = "escopo";
            state.scopeEditMode = true;
            state.saveProposalError = false;
            syncScopeDraftServicesFromProposal(getSelectedProposal());
            syncScopeDraftItemsFromProposal(getSelectedProposal());
            renderProposalPanel();
        } else if (action === "cancel-scope") {
            state.saveProposalError = false;
            state.scopeEditMode = false;
            state.scopeDraftServices = [];
            state.scopeDraftItems = [];
            state.scopeQuickItemOpen = false;
            renderProposalPanel();
        } else if (action === "save-scope") {
            saveScopeData();
        } else if (action === "add-scope-service") {
            addScopeDraftService();
        } else if (action === "remove-scope-service") {
            removeScopeDraftService(Number(actionTrigger.dataset.scopeServiceIndex));
        } else if (action === "add-scope-item") {
            addScopeDraftItem();
        } else if (action === "remove-scope-item") {
            removeScopeDraftItem(Number(actionTrigger.dataset.scopeItemIndex));
        } else if (action === "open-scope-quick-item") {
            state.scopeQuickItemOpen = true;
            renderProposalPanel();
            window.requestAnimationFrame(() => refs.proposalDrawer.querySelector("#scopeQuickItemName")?.focus());
        } else if (action === "cancel-scope-quick-item") {
            state.scopeQuickItemOpen = false;
            renderProposalPanel();
        } else if (action === "save-scope-quick-item") {
            saveScopeQuickItem();
        } else if (action === "open-followup") {
            state.activeDetailTab = "followups";
            state.followupFormOpen = true;
            renderProposalPanel();
        } else if (action === "cancel-followup") {
            state.followupFormOpen = false;
            renderProposalPanel();
        } else if (action === "save-followup") {
            saveFollowup();
        } else if (action === "new-rev") {
            createNewRevision();
        } else if (action === "generate-pdf") {
            generateProposalPdf();
        } else if (action === "generate-critical-analysis-pdf") {
            generateProposalPdf("analise-critica");
        } else if (action === "focus-status") {
            state.activeDetailTab = "resumo";
            state.focusStatusSection = true;
            renderProposalPanel();
        } else if (action === "save-status") {
            saveStatusChange();
        } else if (action === "view-history") {
            state.activeDetailTab = "historico";
            renderProposalPanel();
        } else if (action === "view-followups") {
            state.activeDetailTab = "followups";
            renderProposalPanel();
        } else if (action === "edit-note") {
            state.noteEditMode = true;
            renderProposalPanel();
        } else if (action === "cancel-note") {
            state.noteEditMode = false;
            renderProposalPanel();
        } else if (action === "save-note") {
            saveQuickNote();
        } else if (action === "show-scope-toast") {
            showNotification({
                type: "info",
                title: "Escopo exibido",
                message: "Escopo completo exibido apenas como interação mockada."
            });
        } else if (action === "retry-save-error") {
            retrySaveProposalChanges();
        } else if (action === "dismiss-save-error") {
            state.saveProposalError = false;
            renderProposalPanel();
        }
    }

    async function openFullFollowupAgenda() {
        if (!refs.fullFollowupAgendaModal) {
            return;
        }
        refs.fullFollowupAgendaModal.classList.add("is-open");
        refs.fullFollowupAgendaModal.setAttribute("aria-hidden", "false");
        refs.overlayBackdrop.classList.add("is-visible");
        document.body.classList.add("comercial-no-scroll");
        renderFollowupAgenda();
        await loadFollowups();
        renderUpcomingFollowups();
    }

    function closeFullFollowupAgenda() {
        if (!refs.fullFollowupAgendaModal) {
            return;
        }
        refs.fullFollowupAgendaModal.classList.remove("is-open");
        refs.fullFollowupAgendaModal.setAttribute("aria-hidden", "true");
        state.agendaCreateOpen = false;
        syncOverlayState();
    }

    async function loadFollowups(filters = {}) {
        if (!state.endpoints?.agendaList) {
            state.followupsError = true;
            renderFollowupAgenda();
            return;
        }
        state.agendaLoading = true;
        renderFollowupAgenda();
        const search = filters.search ?? state.agendaSearch;
        const responsavel = filters.responsavel ?? state.agendaResponsavel;
        const status = filters.status ?? state.agendaStatus;
        const period = filters.period ?? state.agendaPeriod;
        const [startDate, endDate] = parseAgendaPeriod(period);
        const params = new URLSearchParams();
        if (search) params.set("q", search);
        if (responsavel && responsavel !== "Todos") params.set("responsavel", responsavel);
        if (status && status !== "Todos") params.set("status", status);
        if (startDate) params.set("start_date", startDate);
        if (endDate) params.set("end_date", endDate);

        try {
            const payload = await fetchJson(`${state.endpoints.agendaList}?${params.toString()}`);
            agendaFollowups = Array.isArray(payload?.items) ? payload.items : [];
            state.agendaSummary = payload?.summary || null;
            state.agendaCalendarDays = Array.isArray(payload?.calendar_days) ? payload.calendar_days : [];
            state.agendaResponsavelOptions = Array.isArray(payload?.responsavel_options) && payload.responsavel_options.length ? payload.responsavel_options : ["Todos"];
            state.agendaStatusOptions = Array.isArray(payload?.status_options) && payload.status_options.length ? payload.status_options : ["Todos", ...FOLLOWUP_STATUSES];
            state.agendaTotalAll = Number(payload?.total_all || 0);
            state.agendaCanViewAll = Boolean(payload?.can_view_all);
            state.agendaLoaded = true;
            state.agendaLoading = false;
            state.followupsError = false;
            state.agendaPage = 1;
            if (!agendaFollowups.some((item) => item.data === state.agendaSelectedDate)) {
                state.agendaSelectedDate = agendaFollowups[0]?.data || state.todayIso;
            }
            renderUpcomingFollowups();
            renderFollowupAgenda();
        } catch (error) {
            state.agendaLoading = false;
            state.followupsError = true;
            renderFollowupAgenda();
            showNotification({
                type: "warning",
                title: "Erro ao carregar follow-ups",
                message: error.message || "Não foi possível sincronizar a agenda comercial neste momento."
            });
        }
    }

    async function saveAgendaFollowup() {
        const propostaId = document.getElementById("agendaCreateProposal")?.value?.trim() || "";
        const data = document.getElementById("agendaCreateDate")?.value?.trim() || "";
        const hora = document.getElementById("agendaCreateTime")?.value?.trim() || "";
        const responsavel = document.getElementById("agendaCreateOwner")?.value?.trim() || "";
        const status = document.getElementById("agendaCreateStatus")?.value?.trim() || "";
        const titulo = document.getElementById("agendaCreateTitle")?.value?.trim() || "";
        const comentario = document.getElementById("agendaCreateComment")?.value?.trim() || "";

        if (!propostaId || !data || !titulo) {
            showNotification({
                type: "warning",
                title: "Atenção",
                message: "Selecione a proposta e preencha data e assunto do follow-up."
            });
            return;
        }
        if (!state.endpoints?.agendaCreate) {
            showNotification({
                type: "warning",
                title: "Integração indisponível",
                message: "O endpoint de criação de follow-up não foi configurado."
            });
            return;
        }

        try {
            const payload = await fetchJson(state.endpoints.agendaCreate, {
                method: "POST",
                body: JSON.stringify({
                    proposta_id: propostaId,
                    data,
                    hora,
                    responsavel,
                    status,
                    titulo,
                    comentario,
                    tipo_contato: "Follow-up comercial"
                })
            });

            upsertProposal(payload?.proposal || {});
            state.agendaCreateOpen = false;
            showNotification({
                type: "success",
                title: "Follow-up criado com sucesso",
                message: "A agenda comercial foi atualizada."
            });
            renderAll();
            await loadFollowups();
        } catch (error) {
            showNotification({
                type: "warning",
                title: "Erro ao criar follow-up",
                message: error.message || "Não foi possível criar o follow-up."
            });
        }
    }

    function renderAgendaEmptyState() {
        if (state.agendaTotalAll <= 0) {
            return `<div class="agenda-empty agenda-empty--initial"><span class="material-icons" aria-hidden="true">event_note</span><h4>Nenhum follow-up cadastrado ainda</h4><p>Crie o primeiro follow-up para acompanhar os próximos contatos comerciais.</p><div class="agenda-empty__actions"><button class="agenda-button agenda-button--primary" data-agenda-action="new-followup" type="button">Criar primeiro follow-up</button></div></div>`;
        }
        return `<div class="agenda-empty agenda-empty--filtered"><span class="material-icons" aria-hidden="true">search_off</span><h4>Nenhum follow-up encontrado</h4><p>Não existem follow-ups para os filtros selecionados.</p><div class="agenda-empty__actions"><button class="agenda-button agenda-button--secondary" data-agenda-action="clear-filters" type="button">Limpar filtros</button><button class="agenda-button agenda-button--primary" data-agenda-action="new-followup" type="button">Novo follow-up</button></div></div>`;
    }

    function renderAgendaCreateForm() {
        if (!state.agendaCreateOpen) return "";
        return `<section class="agenda-create-card"><div class="agenda-create-card__header"><div><h3>Novo follow-up</h3><p>Registre um novo acompanhamento comercial vinculado a uma proposta.</p></div></div><div class="agenda-create-card__grid"><label class="agenda-filter-field"><span>Proposta</span><select id="agendaCreateProposal"><option value="">Selecione a proposta</option>${proposals.map((proposal) => `<option value="${proposal.id}">${escapeHtml(proposal.numeroProposta)} • ${escapeHtml(proposal.empresa)}</option>`).join("")}</select></label><label class="agenda-filter-field"><span>Data do follow-up</span><input id="agendaCreateDate" type="date" value="${escapeHtml(state.agendaSelectedDate || state.todayIso)}"></label><label class="agenda-filter-field"><span>Hora</span><input id="agendaCreateTime" type="time" value="09:00"></label><label class="agenda-filter-field"><span>Responsável</span><select id="agendaCreateOwner">${RESPONSAVEIS.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("")}</select></label><label class="agenda-filter-field"><span>Status</span><select id="agendaCreateStatus">${state.agendaStatusOptions.filter((item) => item !== "Todos").map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("")}</select></label><label class="agenda-filter-field"><span>Assunto / Título</span><input id="agendaCreateTitle" type="text" placeholder="Ex.: Reunião técnica com o cliente"></label><label class="agenda-filter-field agenda-filter-field--full"><span>Comentário</span><textarea id="agendaCreateComment" rows="3" placeholder="Detalhe o contexto do follow-up"></textarea></label></div><div class="agenda-create-card__actions"><button class="agenda-button agenda-button--secondary" data-agenda-action="cancel-new-followup" type="button">Cancelar</button><button class="agenda-button agenda-button--primary" data-agenda-action="save-new-followup" type="button">Salvar follow-up</button></div></section>`;
    }

    function renderFollowupAgenda() {
        const summaryItems = getAgendaFilteredItems({ includeDayFocus: false });
        const pagedItems = getAgendaPagedItems();
        const groups = groupAgendaItemsByDate(pagedItems.items);
        const selectedDayItems = getAgendaDayItems(state.agendaSelectedDate, summaryItems);
        const summary = state.agendaSummary || { hoje: 0, esta_semana: 0, pendentes: 0, responsavel_principal: { nome: "-", total: 0 } };
        refs.fullFollowupAgendaModal.innerHTML = `<div class="agenda-modal__card"><div class="agenda-modal__header"><div class="agenda-modal__title-wrap"><span class="agenda-modal__title-icon"><span class="material-icons" aria-hidden="true">calendar_month</span></span><div><h2 id="agendaModalTitle">Agenda Completa de Follow-ups</h2><p>Visualize, filtre e acompanhe os próximos contatos comerciais.</p></div></div><button class="agenda-modal__close" data-agenda-action="close" type="button" aria-label="Fechar"><span class="material-icons" aria-hidden="true">close</span></button></div><div class="agenda-modal__body"><section class="agenda-summary-cards">${renderAgendaSummaryCard("today", "Hoje", `${summary.hoje}`, "follow-ups")}${renderAgendaSummaryCard("date_range", "Esta semana", `${summary.esta_semana}`, "follow-ups")}${renderAgendaSummaryCard("schedule", "Pendentes", `${summary.pendentes}`, "em aberto")}<article class="agenda-summary-card"><span class="agenda-summary-card__icon"><span class="material-icons" aria-hidden="true">person_outline</span></span><div class="agenda-summary-card__content"><span class="agenda-summary-card__label">Responsável principal</span><strong class="agenda-summary-card__value">${escapeHtml(summary.responsavel_principal?.nome || "-")}</strong><span class="agenda-summary-card__meta">${escapeHtml(String(summary.responsavel_principal?.total || 0))} follow-ups</span></div></article></section><section class="agenda-filters"><label class="agenda-filter-field agenda-filter-field--search"><span>Buscar follow-up</span><div class="agenda-filter-input"><span class="material-icons" aria-hidden="true">search</span><input data-agenda-input="search" type="search" value="${escapeHtml(state.agendaSearch)}" placeholder="Buscar por proposta, cliente ou assunto"></div></label><label class="agenda-filter-field"><span>Período</span><div class="agenda-filter-input"><span class="material-icons" aria-hidden="true">calendar_today</span><input data-agenda-input="period" type="text" value="${escapeHtml(formatAgendaPeriodLabel(state.agendaPeriod))}" placeholder="2026-07-01 | 2026-07-31"></div></label><label class="agenda-filter-field"><span>Responsável</span><select data-agenda-select="responsavel">${state.agendaResponsavelOptions.map((item) => `<option value="${escapeHtml(item)}" ${item === state.agendaResponsavel ? "selected" : ""}>${escapeHtml(item)}</option>`).join("")}</select></label><label class="agenda-filter-field"><span>Status</span><select data-agenda-select="status">${state.agendaStatusOptions.map((item) => `<option value="${escapeHtml(item)}" ${item === state.agendaStatus ? "selected" : ""}>${escapeHtml(item)}</option>`).join("")}</select></label><div class="agenda-filters__actions"><button class="agenda-button agenda-button--secondary" data-agenda-action="clear-filters" type="button">Limpar filtros</button><button class="agenda-button agenda-button--primary" data-agenda-action="apply-filters" type="button">Aplicar filtros</button></div></section>${renderAgendaCreateForm()}<div class="agenda-layout"><section class="agenda-main"><div class="agenda-list-card"><div class="agenda-list-card__header"><div class="agenda-list-card__title"><h3>Agenda por data</h3><span class="agenda-list-card__badge">${pagedItems.total} itens</span></div></div><div class="agenda-groups">${state.agendaLoading ? `<div class="agenda-empty agenda-empty--loading"><span class="material-icons" aria-hidden="true">hourglass_top</span><p>Carregando follow-ups...</p></div>` : groups.length ? groups.map(renderAgendaGroup).join("") : renderAgendaEmptyState()}</div>${pagedItems.total ? `<div class="agenda-pagination"><span class="agenda-pagination__text">Mostrando ${pagedItems.start} a ${pagedItems.end} de ${pagedItems.total} itens</span><div class="agenda-pagination__controls"><button class="agenda-page-btn" data-agenda-action="prev-page" type="button" ${state.agendaPage === 1 ? "disabled" : ""}><span class="material-icons" aria-hidden="true">chevron_left</span></button>${renderAgendaPageButtons(pagedItems.totalPages)}<button class="agenda-page-btn" data-agenda-action="next-page" type="button" ${state.agendaPage === pagedItems.totalPages ? "disabled" : ""}><span class="material-icons" aria-hidden="true">chevron_right</span></button></div><select class="agenda-pagination__select" data-agenda-select="per-page">${[10, 20, 30].map((size) => `<option value="${size}" ${size === state.agendaPerPage ? "selected" : ""}>${size} por página</option>`).join("")}</select></div>` : ""}</div></section><aside class="agenda-side"><section class="agenda-side-card"><div class="agenda-side-card__header"><h3>Calendário</h3><div class="agenda-calendar__nav"><span>${escapeHtml(formatAgendaMonthLabel(state.agendaSelectedDate || state.todayIso))}</span></div></div>${renderAgendaCalendar()}</section><section class="agenda-side-card"><div class="agenda-side-card__header"><div><h3>Resumo do dia</h3><p>${escapeHtml(formatAgendaSummaryDay(state.agendaSelectedDate || state.todayIso))}</p></div><span class="agenda-side-card__badge">${selectedDayItems.length} itens</span></div><div class="agenda-day-summary">${selectedDayItems.length ? selectedDayItems.map((item) => `<article class="agenda-day-summary__item"><span class="agenda-day-summary__dot"></span><div><strong>${escapeHtml(item.hora)} — ${escapeHtml(item.titulo || item.assunto || item.comentario || "")}</strong><p>${escapeHtml(item.numeroProposta || item.numero_proposta || "")} • ${escapeHtml(item.cliente)}</p></div></article>`).join("") : `<p class="agenda-day-summary__empty">Sem follow-ups para o dia selecionado.</p>`}</div><button class="agenda-day-summary__link" data-agenda-action="view-day" type="button">Ver todos do dia</button></section></aside></div></div><div class="agenda-modal__footer"><button class="agenda-button agenda-button--secondary" data-agenda-action="new-followup" type="button"><span class="material-icons" aria-hidden="true">add</span>Novo follow-up</button><button class="agenda-button agenda-button--primary" data-agenda-action="close" type="button">Fechar</button></div></div>`;
    }

    async function applyFollowupAgendaFilters() {
        state.agendaPage = 1;
        state.agendaDayFocus = "";
        await loadFollowups();
    }

    async function clearFollowupAgendaFilters() {
        state.agendaSearch = "";
        state.agendaResponsavel = "Todos";
        state.agendaStatus = "Todos";
        state.agendaPeriod = state.agendaDefaultPeriod;
        state.agendaPage = 1;
        state.agendaPerPage = 10;
        state.agendaDayFocus = "";
        state.agendaSelectedDate = state.todayIso;
        await loadFollowups();
    }

    function selectAgendaDay(date) {
        state.agendaSelectedDate = date;
        renderFollowupAgenda();
    }

    function getAgendaFilteredItems({ includeDayFocus = true } = {}) {
        return agendaFollowups.filter((item) => !includeDayFocus || !state.agendaDayFocus || item.data === state.agendaDayFocus);
    }

    function getAgendaPagedItems() {
        const items = getAgendaFilteredItems();
        const total = items.length;
        const totalPages = Math.max(1, Math.ceil(total / state.agendaPerPage));
        state.agendaPage = Math.min(state.agendaPage, totalPages);
        const startIndex = (state.agendaPage - 1) * state.agendaPerPage;
        const paged = items.slice(startIndex, startIndex + state.agendaPerPage);
        return { items: paged, total, totalPages, start: total ? startIndex + 1 : 0, end: total ? startIndex + paged.length : 0 };
    }

    function getAgendaTotalPages() {
        return Math.max(1, Math.ceil(getAgendaFilteredItems().length / state.agendaPerPage));
    }

    function renderAgendaCalendar() {
        const reference = new Date(`${state.agendaSelectedDate || state.todayIso}T00:00:00`);
        const year = reference.getFullYear();
        const month = reference.getMonth();
        const firstDay = new Date(year, month, 1);
        const totalDays = new Date(year, month + 1, 0).getDate();
        const firstDayIndex = firstDay.getDay();
        const days = [];
        const markers = new Set((state.agendaCalendarDays || []).map((item) => item.date));
        for (let i = 0; i < firstDayIndex; i += 1) days.push(`<span class="agenda-calendar__day is-muted"></span>`);
        for (let day = 1; day <= totalDays; day += 1) {
            const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const isSelected = state.agendaSelectedDate === iso;
            const hasItem = markers.has(iso);
            days.push(`<button class="agenda-calendar__day ${isSelected ? "is-selected" : ""}" data-agenda-action="select-day" data-date="${iso}" type="button"><span>${day}</span>${hasItem ? `<i class="agenda-calendar__dot" aria-hidden="true"></i>` : ""}</button>`);
        }
        return `<div class="agenda-calendar"><div class="agenda-calendar__weekdays">${["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"].map((day) => `<span>${day}</span>`).join("")}</div><div class="agenda-calendar__grid">${days.join("")}</div></div>`;
    }

    function getAgendaDayItems(date, baseItems = agendaFollowups) {
        return baseItems.filter((item) => item.data === date).sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));
    }

    function renderAgendaPageButtons(totalPages) {
        return Array.from({ length: totalPages }, (_, index) => {
            const page = index + 1;
            return `<button class="agenda-page-btn ${page === state.agendaPage ? "is-active" : ""}" data-agenda-action="go-page" data-page="${page}" type="button">${page}</button>`;
        }).join("");
    }

    function parseAgendaPeriod(value) {
        if (!value || !value.trim()) return ["", ""];
        if (value.includes("|")) {
            const [start, end] = value.split("|").map((item) => item.trim());
            return [normalizeAgendaDateToIso(start), normalizeAgendaDateToIso(end)];
        }
        return ["", ""];
    }

    function getDetailSelectOptions(metadataKey, currentValue) {
        const options = Array.isArray(commercialBootstrap?.metadata?.[metadataKey])
            ? [...commercialBootstrap.metadata[metadataKey]]
            : [];
        const normalizedCurrentValue = String(currentValue || "").trim();

        // Preserva a exibição de registros antigos que já não estejam disponíveis para novos cadastros.
        if (normalizedCurrentValue && !options.some((item) => String(item || "").trim() === normalizedCurrentValue)) {
            options.unshift(normalizedCurrentValue);
        }

        return options;
    }

    function formatAgendaPeriodLabel(value) {
        if (!value || !value.trim()) return "";
        const [start = "", end = ""] = value.split("|").map((item) => item.trim());
        const formattedStart = formatAgendaDateBr(start);
        const formattedEnd = formatAgendaDateBr(end);

        if (formattedStart && formattedEnd) return `${formattedStart} | ${formattedEnd}`;
        return formattedStart || formattedEnd;
    }

    function normalizeAgendaDateToIso(value) {
        const date = String(value || "").trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;

        const match = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
    }

    function formatAgendaDateBr(value) {
        const date = String(value || "").trim();
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) return date;
        return formatDateBr(normalizeAgendaDateToIso(date));
    }

    function formatAgendaGroupDate(isoDate) {
        if (!isoDate) return "";
        return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date(`${isoDate}T00:00:00`));
    }

    function formatAgendaMonthLabel(isoDate) {
        if (!isoDate) return "";
        return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(`${isoDate}T00:00:00`));
    }

    function formatAgendaSummaryDay(isoDate) {
        if (!isoDate) return "";
        return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date(`${isoDate}T00:00:00`));
    }

    function formatDateBr(isoDate) {
        if (!isoDate) return "";
        const [year, month, day] = isoDate.split("-");
        return `${day}/${month}/${year}`;
    }

    function formatAgendaDay(isoDate) {
        return isoDate?.split("-")[2] || "";
    }

    function formatAgendaMonthShort(isoDate) {
        const month = isoDate?.split("-")[1] || "";
        return ({ "01": "JAN", "02": "FEV", "03": "MAR", "04": "ABR", "05": "MAI", "06": "JUN", "07": "JUL", "08": "AGO", "09": "SET", "10": "OUT", "11": "NOV", "12": "DEZ" })[month] || month;
    }

    function groupAgendaItemsByDate(items) {
        const groups = new Map();
        items.forEach((item) => {
            if (!groups.has(item.data)) groups.set(item.data, []);
            groups.get(item.data).push(item);
        });
        return [...groups.entries()].map(([date, entries]) => ({ date, entries }));
    }

    function renderAgendaGroup(group) {
        return `<section class="agenda-group"><div class="agenda-group__header"><div class="agenda-group__title"><span class="material-icons" aria-hidden="true">calendar_today</span><h4>${escapeHtml(formatAgendaGroupDate(group.date))}</h4></div><span>${group.entries.length} follow-ups</span></div><div class="agenda-group__items">${group.entries.map((item) => `<article class="agenda-item"><div class="agenda-item__date"><strong>${escapeHtml(formatAgendaDay(item.data))}</strong><span>${escapeHtml(formatAgendaMonthShort(item.data))}</span></div><div class="agenda-item__time">${escapeHtml(item.hora || "--:--")}</div><div class="agenda-item__content"><span class="agenda-item__proposal">${escapeHtml(item.numero_proposta || item.numeroProposta)}</span><strong>${escapeHtml(item.cliente)}</strong><p>${escapeHtml(item.titulo || item.assunto || item.comentario || "")}</p></div><div class="agenda-item__owner">${escapeHtml(item.responsavel)}</div><div class="agenda-item__contact"><span class="material-icons" aria-hidden="true">contact_phone</span></div><div class="agenda-item__status"><span class="agenda-status-badge ${slugify(item.status)}">${escapeHtml(item.status)}</span></div></article>`).join("")}</div></section>`;
    }

    function renderAgendaSummaryCard(icon, label, value, meta) {
        return `<article class="agenda-summary-card"><span class="agenda-summary-card__icon"><span class="material-icons" aria-hidden="true">${icon}</span></span><div class="agenda-summary-card__content"><span class="agenda-summary-card__label">${label}</span><strong class="agenda-summary-card__value">${value}</strong><span class="agenda-summary-card__meta">${meta}</span></div></article>`;
    }

    function renderFollowups() {
        if (!refs.followupList || !refs.viewAgendaButton) {
            return;
        }

        if (state.followupsError) {
            refs.followupList.innerHTML = `
                <div class="sidebar-error-state">
                    <span class="sidebar-error-state__icon material-icons" aria-hidden="true">warning</span>
                    <h3>Erro ao carregar acompanhamentos</h3>
                    <p>Não foi possível sincronizar os acompanhamentos comerciais neste momento.</p>
                    <button class="panel-button panel-button--soft" data-retry-followups type="button">Tentar novamente</button>
                    <small>Última atualização: há 5 min</small>
                </div>
            `;
            refs.viewAgendaButton.disabled = true;
            return;
        }

        const sidebarFollowups = proposals
            .flatMap((proposal) => proposal.followUps.map((item) => ({ proposal, item })))
            .filter((entry) => entry.item.dataProximaAcao)
            .sort((a, b) => compareDates(a.item.dataProximaAcao, b.item.dataProximaAcao))
            .slice(0, 3);

        if (!sidebarFollowups.length) {
            refs.followupList.innerHTML = `
                <div class="sidebar-empty-state">
                    <span class="material-icons" aria-hidden="true">event_busy</span>
                    <p>Nenhum acompanhamento pendente no momento.</p>
                </div>
            `;
            refs.viewAgendaButton.disabled = true;
            return;
        }

        refs.followupList.innerHTML = sidebarFollowups.map(({ proposal, item }) => {
            const [day, month] = formatAgendaDate(item.dataProximaAcao);
            return `
                <article class="followup-entry">
                    <div class="followup-entry__date">
                        <strong>${escapeHtml(day)}</strong>
                        <span>${escapeHtml(month)}</span>
                    </div>
                    <div class="followup-entry__content">
                        <div class="followup-entry__header">
                            <strong>${escapeHtml(proposal.numeroProposta)}</strong>
                            <span>${escapeHtml(item.hora || "--:--")}</span>
                        </div>
                        <p>${escapeHtml(proposal.empresa)}</p>
                        <small>${escapeHtml(item.proximaAcao || item.comentario || "Acompanhamento comercial")}</small>
                        <span class="followup-entry__owner">${escapeHtml(item.responsavel)}</span>
                    </div>
                </article>
            `;
        }).join("");

        refs.viewAgendaButton.disabled = false;
    }

    async function saveAgendaFollowup() {
        const propostaId = document.getElementById("agendaCreateProposal")?.value?.trim() || "";
        const data = document.getElementById("agendaCreateDate")?.value?.trim() || "";
        const hora = document.getElementById("agendaCreateTime")?.value?.trim() || "";
        const responsavel = document.getElementById("agendaCreateOwner")?.value?.trim() || "";
        const tipoContato = document.getElementById("agendaCreateType")?.value?.trim() || "";
        const status = document.getElementById("agendaCreateStatus")?.value?.trim() || "";
        const titulo = document.getElementById("agendaCreateTitle")?.value?.trim() || "";
        const comentario = document.getElementById("agendaCreateComment")?.value?.trim() || "";
        const proximaAcao = document.getElementById("agendaCreateNextAction")?.value?.trim() || "";
        const dataProximaAcao = document.getElementById("agendaCreateNextDate")?.value?.trim() || "";

        if (!propostaId || !data || !titulo) {
            showNotification({
                type: "warning",
                title: "Atenção",
                message: "Selecione a proposta e preencha data e assunto do acompanhamento."
            });
            return;
        }

        if (!state.endpoints?.agendaCreate) {
            showNotification({
                type: "warning",
                title: "Integração indisponível",
                message: "O endpoint de criação de acompanhamento não foi configurado."
            });
            return;
        }

        try {
            const payload = await fetchJson(state.endpoints.agendaCreate, {
                method: "POST",
                body: JSON.stringify({
                    proposta_id: propostaId,
                    data,
                    hora,
                    responsavel,
                    status,
                    titulo,
                    comentario,
                    proxima_acao: proximaAcao,
                    data_proxima_acao: dataProximaAcao,
                    tipo_contato: tipoContato || "Atualização interna"
                })
            });

            upsertProposal(payload?.proposal || {});
            state.agendaCreateOpen = false;
            showNotification({
                type: "success",
                title: "Acompanhamento criado com sucesso",
                message: "Os acompanhamentos comerciais foram atualizados."
            });
            renderAll();
            await loadFollowups();
        } catch (error) {
            showNotification({
                type: "warning",
                title: "Erro ao criar acompanhamento",
                message: error.message || "Não foi possível criar o acompanhamento."
            });
        }
    }

    function renderAgendaEmptyState() {
        if (state.agendaTotalAll <= 0) {
            return `<div class="agenda-empty agenda-empty--initial"><span class="material-icons" aria-hidden="true">event_note</span><h4>Nenhum acompanhamento cadastrado ainda</h4><p>Registre o primeiro acompanhamento para manter o histórico comercial da proposta atualizado.</p><div class="agenda-empty__actions"><button class="agenda-button agenda-button--primary" data-agenda-action="new-followup" type="button">Registrar acompanhamento</button></div></div>`;
        }

        return `<div class="agenda-empty agenda-empty--filtered"><span class="material-icons" aria-hidden="true">search_off</span><h4>Nenhum acompanhamento encontrado</h4><p>Nenhum registro corresponde aos filtros aplicados.</p><div class="agenda-empty__actions"><button class="agenda-button agenda-button--secondary" data-agenda-action="clear-filters" type="button">Limpar filtros</button><button class="agenda-button agenda-button--primary" data-agenda-action="new-followup" type="button">Registrar acompanhamento</button></div></div>`;
    }

    function renderAgendaCreateForm() {
        if (!state.agendaCreateOpen) return "";

        return `<section class="agenda-create-card"><div class="agenda-create-card__header"><div><h3>Registrar acompanhamento</h3><p>Registre uma atualização comercial sobre a proposta.</p></div></div><div class="agenda-create-card__grid"><label class="agenda-filter-field"><span>Proposta</span><select id="agendaCreateProposal"><option value="">Selecione a proposta</option>${proposals.map((proposal) => `<option value="${proposal.id}">${escapeHtml(proposal.numeroProposta)} • ${escapeHtml(proposal.empresa)}</option>`).join("")}</select></label><label class="agenda-filter-field"><span>Data do acompanhamento</span><input id="agendaCreateDate" type="date" value="${escapeHtml(state.agendaSelectedDate || state.todayIso)}"></label><label class="agenda-filter-field"><span>Hora</span><input id="agendaCreateTime" type="time" value="09:00"></label><label class="agenda-filter-field"><span>Responsável</span><select id="agendaCreateOwner">${RESPONSAVEIS.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("")}</select></label><label class="agenda-filter-field"><span>Tipo de contato</span><select id="agendaCreateType">${FOLLOWUP_TYPES.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("")}</select></label><label class="agenda-filter-field"><span>Status do acompanhamento</span><select id="agendaCreateStatus">${state.agendaStatusOptions.filter((item) => item !== "Todos").map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("")}</select></label><label class="agenda-filter-field agenda-filter-field--full"><span>Comentário / atualização</span><textarea id="agendaCreateComment" rows="3" placeholder="Descreva o que foi alinhado, informado ou atualizado sobre a proposta."></textarea></label><label class="agenda-filter-field agenda-filter-field--full"><span>Próxima ação</span><input id="agendaCreateNextAction" type="text" placeholder="Ex: Retornar ao cliente com ajuste de escopo."></label><label class="agenda-filter-field"><span>Data prevista para próximo retorno</span><input id="agendaCreateNextDate" type="date"></label></div><div class="agenda-create-card__actions"><button class="agenda-button agenda-button--secondary" data-agenda-action="cancel-new-followup" type="button">Cancelar</button><button class="agenda-button agenda-button--primary" data-agenda-action="save-new-followup" type="button">Registrar acompanhamento</button></div></section>`;
    }

    function renderFollowupAgenda() {
        const summaryItems = getAgendaFilteredItems({ includeDayFocus: false });
        const pagedItems = getAgendaPagedItems();
        const groups = groupAgendaItemsByDate(pagedItems.items);
        const selectedDayItems = getAgendaDayItems(state.agendaSelectedDate, summaryItems);
        const summary = state.agendaSummary || { hoje: 0, esta_semana: 0, pendentes: 0, responsavel_principal: { nome: "-", total: 0 } };

        const agendaTitle = state.agendaCanViewAll ? "Acompanhamentos Comerciais" : "Meus Follow-ups";
        const agendaSubtitle = state.agendaCanViewAll ? "Visualize, filtre e registre os acompanhamentos comerciais." : "Visualize, filtre e registre os seus acompanhamentos comerciais.";
        refs.fullFollowupAgendaModal.innerHTML = `<div class="agenda-modal__card"><div class="agenda-modal__header"><div class="agenda-modal__title-wrap"><span class="agenda-modal__title-icon"><span class="material-icons" aria-hidden="true">calendar_month</span></span><div><h2 id="agendaModalTitle">${agendaTitle}</h2><p>${agendaSubtitle}</p></div></div><button class="agenda-modal__close" data-agenda-action="close" type="button" aria-label="Fechar"><span class="material-icons" aria-hidden="true">close</span></button></div><div class="agenda-modal__body"><section class="agenda-summary-cards">${renderAgendaSummaryCard("today", "Hoje", `${summary.hoje}`, "acompanhamentos")}${renderAgendaSummaryCard("date_range", "Esta semana", `${summary.esta_semana}`, "acompanhamentos")}${renderAgendaSummaryCard("schedule", "Pendentes de retorno", `${summary.pendentes}`, "acompanhamentos")}</section><section class="agenda-filters"><label class="agenda-filter-field agenda-filter-field--search"><span>Buscar acompanhamento</span><div class="agenda-filter-input"><span class="material-icons" aria-hidden="true">search</span><input data-agenda-input="search" type="search" value="${escapeHtml(state.agendaSearch)}" placeholder="Buscar por proposta, cliente ou assunto"></div></label><label class="agenda-filter-field"><span>Período</span><div class="agenda-filter-input"><span class="material-icons" aria-hidden="true">calendar_today</span><input data-agenda-input="period" type="text" inputmode="numeric" value="${escapeHtml(formatAgendaPeriodLabel(state.agendaPeriod))}" placeholder="dd/mm/aaaa | dd/mm/aaaa"></div></label><label class="agenda-filter-field"><span>Status</span><select data-agenda-select="status">${state.agendaStatusOptions.map((item) => `<option value="${escapeHtml(item)}" ${item === state.agendaStatus ? "selected" : ""}>${escapeHtml(item)}</option>`).join("")}</select></label><div class="agenda-filters__actions"><button class="agenda-button agenda-button--secondary" data-agenda-action="clear-filters" type="button">Limpar filtros</button><button class="agenda-button agenda-button--primary" data-agenda-action="apply-filters" type="button">Aplicar filtros</button></div></section>${renderAgendaCreateForm()}<div class="agenda-layout"><section class="agenda-main"><div class="agenda-list-card"><div class="agenda-list-card__header"><div class="agenda-list-card__title"><h3>Acompanhamentos por data</h3><span class="agenda-list-card__badge">${pagedItems.total} itens</span></div></div><div class="agenda-groups">${state.agendaLoading ? `<div class="agenda-empty agenda-empty--loading"><span class="material-icons" aria-hidden="true">hourglass_top</span><p>Carregando acompanhamentos...</p></div>` : groups.length ? groups.map(renderAgendaGroup).join("") : renderAgendaEmptyState()}</div>${pagedItems.total ? `<div class="agenda-pagination"><span class="agenda-pagination__text">Mostrando ${pagedItems.start} a ${pagedItems.end} de ${pagedItems.total} itens</span><div class="agenda-pagination__controls"><button class="agenda-page-btn" data-agenda-action="prev-page" type="button" ${state.agendaPage === 1 ? "disabled" : ""}><span class="material-icons" aria-hidden="true">chevron_left</span></button>${renderAgendaPageButtons(pagedItems.totalPages)}<button class="agenda-page-btn" data-agenda-action="next-page" type="button" ${state.agendaPage === pagedItems.totalPages ? "disabled" : ""}><span class="material-icons" aria-hidden="true">chevron_right</span></button></div><select class="agenda-pagination__select" data-agenda-select="per-page">${[10, 20, 30].map((size) => `<option value="${size}" ${size === state.agendaPerPage ? "selected" : ""}>${size} por página</option>`).join("")}</select></div>` : ""}</div></section><aside class="agenda-side"><section class="agenda-side-card"><div class="agenda-side-card__header"><h3>Calendário</h3><div class="agenda-calendar__nav"><span>${escapeHtml(formatAgendaMonthLabel(state.agendaSelectedDate || state.todayIso))}</span></div></div>${renderAgendaCalendar()}</section><section class="agenda-side-card"><div class="agenda-side-card__header"><div><h3>Acompanhamentos do dia</h3><p>${escapeHtml(formatAgendaSummaryDay(state.agendaSelectedDate || state.todayIso))}</p></div><span class="agenda-side-card__badge">${selectedDayItems.length} itens</span></div><div class="agenda-day-summary">${selectedDayItems.length ? selectedDayItems.map((item) => `<article class="agenda-day-summary__item"><span class="agenda-day-summary__dot"></span><div><strong>${escapeHtml(item.hora)} — ${escapeHtml(item.titulo || item.assunto || item.comentario || "")}</strong><p>${escapeHtml(item.numeroProposta || item.numero_proposta || "")} • ${escapeHtml(item.cliente)}</p></div></article>`).join("") : `<p class="agenda-day-summary__empty">Sem acompanhamentos para este dia.</p>`}</div></section></aside></div></div><div class="agenda-modal__footer"><button class="agenda-button agenda-button--secondary" data-agenda-action="new-followup" type="button"><span class="material-icons" aria-hidden="true">add</span>Registrar acompanhamento</button><button class="agenda-button agenda-button--primary" data-agenda-action="close" type="button">Fechar</button></div></div>`;
    }

    function renderAgendaGroup(group) {
        return `<section class="agenda-group"><div class="agenda-group__header"><div class="agenda-group__title"><span class="material-icons" aria-hidden="true">calendar_today</span><h4>${escapeHtml(formatAgendaGroupDate(group.date))}</h4></div><span>${group.entries.length} acompanhamentos</span></div><div class="agenda-group__items">${group.entries.map((item) => `<article class="agenda-item agenda-item--detailed"><div class="agenda-item__date"><strong>${escapeHtml(formatAgendaDay(item.data))}</strong><span>${escapeHtml(formatAgendaMonthShort(item.data))}</span></div><div class="agenda-item__contact-meta"><strong><i></i>${escapeHtml(item.hora || "--:--")}</strong><span><span class="material-icons" aria-hidden="true">${agendaContactIcon(item.tipo_contato)}</span>${escapeHtml(item.tipo_contato || "Acompanhamento")}</span></div><div class="agenda-item__proposal-detail"><strong>${escapeHtml(item.numero_proposta || item.numeroProposta)}</strong><span>${escapeHtml(item.cliente || "Cliente não informado")}</span><small>${item.revisao ? `REV ${escapeHtml(item.revisao)} · ` : ""}${escapeHtml(item.unidade || "Unidade não informada")}</small></div><div class="agenda-item__subject"><strong>${escapeHtml(item.titulo || "Acompanhamento comercial")}</strong><p>${escapeHtml(item.comentario || "Sem observação complementar.")}</p></div><div class="agenda-item__owner-detail"><span class="material-icons" aria-hidden="true">person</span><strong>${escapeHtml(item.responsavel || "Não informado")}</strong></div><div class="agenda-item__outcome"><span class="agenda-proposal-status ${slugify(item.status_proposta || item.status)}">${escapeHtml(item.status_proposta || item.status || "Sem status")}</span><small>Próxima ação</small><p>${escapeHtml(item.proxima_acao || "Não informada")}</p></div></article>`).join("")}</div></section>`;
    }

    function agendaContactIcon(type) {
        const normalized = String(type || "").toLowerCase();
        if (normalized.includes("e-mail") || normalized.includes("email")) return "mail";
        if (normalized.includes("whatsapp")) return "chat";
        if (normalized.includes("reuni")) return "groups";
        if (normalized.includes("liga")) return "call";
        return "event_note";
    }

    function todayDate() {
        return state.todayIso ? formatDateBr(state.todayIso) : formatDateBr("2026-07-14");
    }

    function currentTime() {
        const now = new Date();
        return String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
    }

    function slugify(value) {
        return "is-" + value.toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function renderUpcomingFollowups() {
        if (!refs.upcomingFollowupsList) {
            return;
        }

        const upcomingItems = agendaFollowups
            .filter((item) => item.status !== "Realizado" && item.status !== "Concluído" && item.status !== "Cancelado")
            .sort((left, right) => `${left.data || ""}${left.hora || ""}`.localeCompare(`${right.data || ""}${right.hora || ""}`))
            .slice(0, 3);

        if (!upcomingItems.length) {
            refs.upcomingFollowupsList.innerHTML = `
                <div class="upcoming-followups-empty">
                    <span class="material-icons" aria-hidden="true">event_available</span>
                    <p>Nenhum follow-up próximo para você.</p>
                </div>
            `;
            return;
        }

        refs.upcomingFollowupsList.innerHTML = upcomingItems.map((item) => `
            <article class="upcoming-followup-item">
                <time class="upcoming-followup-item__date" datetime="${escapeHtml(item.data)}">
                    <strong>${escapeHtml(formatAgendaDay(item.data))}</strong>
                    <span>${escapeHtml(formatAgendaMonthShort(item.data))}</span>
                </time>
                <div class="upcoming-followup-item__content">
                    <strong>${escapeHtml(item.cliente || "Cliente não informado")}</strong>
                    <p>${escapeHtml(item.titulo || item.proxima_acao || "Acompanhamento comercial")}</p>
                </div>
                <span class="upcoming-followup-item__time">${escapeHtml(item.hora || "--:--")}</span>
            </article>
        `).join("");
    }
});

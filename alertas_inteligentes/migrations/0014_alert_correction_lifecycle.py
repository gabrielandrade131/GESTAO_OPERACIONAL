from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


MOTIVOS_ENCERRAMENTO = [
    ("", "Não informado"),
    ("correcao_confirmada", "Correção confirmada pela IA"),
    ("resolucao_manual", "Encerrado manualmente"),
    ("excecao_aceita", "Exceção aceita"),
    ("mudanca_contexto", "Encerrado por mudança de contexto"),
    ("reanalise_legada", "Encerrado por reanálise anterior"),
]

ORIGENS_CORRECAO = [
    ("", "Não informada"),
    ("usuario", "Edição de usuário"),
    ("automatica", "Correção automática"),
    ("nao_identificada", "Responsável não identificado"),
]


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("alertas_inteligentes", "0013_alter_alertainteligente_tipo"),
    ]

    operations = [
        migrations.AddField(
            model_name="alertainteligente",
            name="corrigido_em",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="alertainteligente",
            name="corrigido_por",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="alertas_rdo_corrigidos",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="alertainteligente",
            name="motivo_encerramento",
            field=models.CharField(blank=True, choices=MOTIVOS_ENCERRAMENTO, default="", max_length=40),
        ),
        migrations.AddField(
            model_name="alertainteligente",
            name="origem_correcao",
            field=models.CharField(blank=True, choices=ORIGENS_CORRECAO, default="", max_length=30),
        ),
        migrations.AddField(
            model_name="alertainteligente",
            name="quantidade_ocorrencias",
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name="alertainteligente",
            name="ultima_ocorrencia_em",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="alertaoperacionalinteligente",
            name="corrigido_em",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="alertaoperacionalinteligente",
            name="corrigido_por",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="alertas_operacionais_corrigidos",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="alertaoperacionalinteligente",
            name="motivo_encerramento",
            field=models.CharField(blank=True, choices=MOTIVOS_ENCERRAMENTO, default="", max_length=40),
        ),
        migrations.AddField(
            model_name="alertaoperacionalinteligente",
            name="origem_correcao",
            field=models.CharField(blank=True, choices=ORIGENS_CORRECAO, default="", max_length=30),
        ),
        migrations.AddField(
            model_name="alertaoperacionalinteligente",
            name="quantidade_ocorrencias",
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name="alertaoperacionalinteligente",
            name="ultima_ocorrencia_em",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddIndex(
            model_name="alertainteligente",
            index=models.Index(
                fields=["status", "motivo_encerramento", "corrigido_em"],
                name="alert_rdo_corr_status_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="alertaoperacionalinteligente",
            index=models.Index(
                fields=["status", "motivo_encerramento", "corrigido_em"],
                name="alert_oper_corr_status_idx",
            ),
        ),
    ]

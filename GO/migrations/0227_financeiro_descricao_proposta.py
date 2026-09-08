from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("GO", "0226_financeiro_ambiente_operacional"),
    ]

    operations = [
        migrations.AddField(
            model_name="financeiro",
            name="descricao_proposta",
            field=models.TextField(blank=True, null=True),
        ),
    ]

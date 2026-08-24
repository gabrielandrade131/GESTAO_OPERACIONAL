from django.db import migrations, models


FINANCEIRO_TABLE = "GO_financeiro"
RELATED_TABLES = (
    "GO_analisecriticaoportunidade",
    "GO_financeirocampo",
    "GO_propostadocumentorevisao",
    "GO_anexopropostacomercial",
)
NULLABLE_COLUMNS = (
    "natureza",
    "status_proposta",
    "uf",
    "estimativo_receita",
    "fonte_lead",
    "segmento_cliente",
    "cliente_id",
)


def _quote(name):
    return '"{}"'.format(name.replace('"', '""'))


def _table_sql(cursor, table_name):
    cursor.execute(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = %s",
        [table_name],
    )
    row = cursor.fetchone()
    if not row or not row[0]:
        raise RuntimeError("Tabela esperada nao encontrada: {}".format(table_name))
    return row[0]


def _indexes(cursor, table_name):
    cursor.execute(
        "SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = %s AND sql IS NOT NULL",
        [table_name],
    )
    return [row[0] for row in cursor.fetchall()]


def _columns(cursor, table_name):
    cursor.execute("PRAGMA table_info({})".format(_quote(table_name)))
    return [row[1] for row in cursor.fetchall()]


def _make_financeiro_sql(source_sql):
    target = source_sql.replace(
        'CREATE TABLE "GO_financeiro"',
        'CREATE TABLE "GO_financeiro__historico_tmp"',
        1,
    )
    old_pk = '"proposta" integer NOT NULL PRIMARY KEY'
    new_pk = '"id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "proposta" integer NOT NULL'
    if old_pk not in target:
        raise RuntimeError("A PK esperada de GO_financeiro nao foi encontrada.")
    target = target.replace(old_pk, new_pk, 1)
    for column in NULLABLE_COLUMNS:
        marker = '"{}"'.format(column)
        start = target.find(marker)
        if start == -1:
            raise RuntimeError("Coluna esperada nao encontrada: {}".format(column))
        end = target.find(',', start)
        if end == -1:
            end = target.find(')', start)
        definition = target[start:end]
        target = target[:start] + definition.replace(' NOT NULL', ' NULL') + target[end:]
    closing = target.rfind(')')
    return (
        target[:closing]
        + ', "importado_historico" bool NOT NULL DEFAULT 0'
        + target[closing:]
    )


def _make_related_sql(source_sql, table_name):
    temporary_name = "{}__historico_tmp".format(table_name)
    target = source_sql.replace(
        'CREATE TABLE "{}"'.format(table_name),
        'CREATE TABLE "{}"'.format(temporary_name),
        1,
    )
    target = target.replace(
        'REFERENCES "GO_financeiro" ("proposta")',
        'REFERENCES "GO_financeiro" ("id")',
    )
    if target == source_sql:
        raise RuntimeError("Nao foi possivel atualizar a relacao de {}.".format(table_name))
    return target


def forward_migrate_financeiro_identity(apps, schema_editor):
    """Rebuild the SQLite tables while preserving old commercial-number relations."""
    connection = schema_editor.connection
    if connection.vendor != "sqlite":
        raise RuntimeError(
            "A migracao de identidade Financeiro exige um plano validado para este banco. "
            "Execute-a primeiro em uma copia de seguranca SQLite."
        )

    cursor = connection.cursor()
    parent_sql = _table_sql(cursor, FINANCEIRO_TABLE)
    related_sql = {table: _table_sql(cursor, table) for table in RELATED_TABLES}
    indexes = {table: _indexes(cursor, table) for table in (FINANCEIRO_TABLE,) + RELATED_TABLES}
    parent_columns = _columns(cursor, FINANCEIRO_TABLE)
    related_columns = {table: _columns(cursor, table) for table in RELATED_TABLES}

    cursor.execute("PRAGMA foreign_keys = OFF")
    try:
        cursor.execute(_make_financeiro_sql(parent_sql))
        copied_columns = ", ".join(_quote(column) for column in parent_columns)
        cursor.execute(
            "INSERT INTO {new} ({target_columns}) "
            "SELECT {source_id}, {source_columns}, 0 FROM {old}".format(
                new=_quote("GO_financeiro__historico_tmp"),
                target_columns=", ".join([_quote("id"), copied_columns, _quote("importado_historico")]),
                source_id=_quote("proposta"),
                source_columns=copied_columns,
                old=_quote(FINANCEIRO_TABLE),
            )
        )

        for table_name, source_sql in related_sql.items():
            cursor.execute(_make_related_sql(source_sql, table_name))
            columns = ", ".join(_quote(column) for column in related_columns[table_name])
            cursor.execute(
                "INSERT INTO {new} ({columns}) SELECT {columns} FROM {old}".format(
                    new=_quote("{}__historico_tmp".format(table_name)),
                    columns=columns,
                    old=_quote(table_name),
                )
            )

        for table_name in RELATED_TABLES:
            cursor.execute("DROP TABLE {}".format(_quote(table_name)))
        cursor.execute("DROP TABLE {}".format(_quote(FINANCEIRO_TABLE)))
        cursor.execute(
            "ALTER TABLE {} RENAME TO {}".format(
                _quote("GO_financeiro__historico_tmp"), _quote(FINANCEIRO_TABLE)
            )
        )
        for table_name in RELATED_TABLES:
            cursor.execute(
                "ALTER TABLE {} RENAME TO {}".format(
                    _quote("{}__historico_tmp".format(table_name)), _quote(table_name)
                )
            )

        for table_indexes in indexes.values():
            for index_sql in table_indexes:
                cursor.execute(index_sql)
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS {} ON {} ({})".format(
                _quote("GO_financeiro_proposta_8f4e405f"),
                _quote(FINANCEIRO_TABLE),
                _quote("proposta"),
            )
        )
        cursor.execute("PRAGMA foreign_key_check")
        violations = cursor.fetchall()
        if violations:
            raise RuntimeError("Falha ao preservar chaves estrangeiras: {}".format(violations))
    finally:
        cursor.execute("PRAGMA foreign_keys = ON")


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ("GO", "0217_supervisorhandover"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[migrations.RunPython(forward_migrate_financeiro_identity, migrations.RunPython.noop)],
            state_operations=[
                migrations.AddField(
                    model_name="financeiro",
                    name="id",
                    field=models.BigAutoField(primary_key=True, serialize=False),
                ),
                migrations.AddField(
                    model_name="financeiro",
                    name="importado_historico",
                    field=models.BooleanField(db_index=True, default=False),
                ),
                migrations.AlterField(
                    model_name="financeiro",
                    name="proposta",
                    field=models.IntegerField(db_index=True),
                ),
                migrations.AlterField(
                    model_name="financeiro",
                    name="cliente",
                    field=models.ForeignKey(blank=True, null=True, on_delete=models.PROTECT, related_name="propostas_cliente", to="GO.ordemservico"),
                ),
                migrations.AlterField(
                    model_name="financeiro",
                    name="estimativo_receita",
                    field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
                ),
                migrations.AlterField(
                    model_name="financeiro",
                    name="fonte_lead",
                    field=models.CharField(blank=True, choices=[('Vendas Ambipar', 'Vendas Ambipar'), ('Indicação', 'Indicação'), ('Site', 'Site'), ('Licitação', 'Licitação'), ('Outro', 'Outro')], max_length=50, null=True),
                ),
                migrations.AlterField(
                    model_name="financeiro",
                    name="natureza",
                    field=models.CharField(blank=True, choices=[('Contrato Novo', 'Contrato Novo'), ('Renovação', 'Renovação'), ('Aditivo', 'Aditivo'), ('Spot', 'Spot')], max_length=50, null=True),
                ),
                migrations.AlterField(
                    model_name="financeiro",
                    name="segmento_cliente",
                    field=models.CharField(blank=True, choices=[('Offshore', 'Offshore'), ('Onshore', 'Onshore'), ('Indústria', 'Indústria'), ('Óleo e Gás', 'Óleo e Gás'), ('Outros', 'Outros')], max_length=50, null=True),
                ),
                migrations.AlterField(
                    model_name="financeiro",
                    name="status_proposta",
                    field=models.CharField(blank=True, choices=[('Sem Retorno', 'Sem Retorno'), ('Em Análise', 'Em Análise'), ('Avaliando escopo', 'Avaliando escopo'), ('Em Elaboração', 'Em Elaboração'), ('Aguardando aprovação gestores', 'Aguardando aprovação gestores'), ('Revisada', 'Revisada'), ('ShortList', 'ShortList'), ('Em Negociação', 'Em Negociação'), ('Fechada/Contratada', 'Fechada/Contratada'), ('Perdida/Recusada', 'Perdida/Recusada'), ('Cancelada', 'Cancelada'), ('Declínio', 'Declínio')], max_length=50, null=True),
                ),
                migrations.AlterField(
                    model_name="financeiro",
                    name="uf",
                    field=models.CharField(blank=True, choices=[('AC', 'Acre'), ('AL', 'Alagoas'), ('AP', 'Amapá'), ('AM', 'Amazonas'), ('BA', 'Bahia'), ('CE', 'Ceará'), ('DF', 'Distrito Federal'), ('ES', 'Espírito Santo'), ('GO', 'Goiás'), ('MA', 'Maranhão'), ('MT', 'Mato Grosso'), ('MS', 'Mato Grosso do Sul'), ('MG', 'Minas Gerais'), ('PA', 'Pará'), ('PB', 'Paraíba'), ('PR', 'Paraná'), ('PE', 'Pernambuco'), ('PI', 'Piauí'), ('RJ', 'Rio de Janeiro'), ('RN', 'Rio Grande do Norte'), ('RS', 'Rio Grande do Sul'), ('RO', 'Rondônia'), ('RR', 'Roraima'), ('SC', 'Santa Catarina'), ('SP', 'São Paulo'), ('SE', 'Sergipe'), ('TO', 'Tocantins')], max_length=10, null=True),
                ),
            ],
        ),
    ]

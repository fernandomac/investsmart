from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('ativo', '0013_snapshot'),
    ]

    operations = [
        migrations.AddField(
            model_name='ativo',
            name='valor_atual',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=15),
        ),
        migrations.AddField(
            model_name='ativo',
            name='rendimento',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=15),
        ),
        migrations.AddField(
            model_name='ativo',
            name='is_preco_estimado',
            field=models.BooleanField(default=False),
        ),
    ] 
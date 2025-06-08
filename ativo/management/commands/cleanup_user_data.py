from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from ativo.models import Ativo, Movimentacao, Dividendo, EvolucaoPatrimonial

User = get_user_model()

class Command(BaseCommand):
    help = 'Clean up all ativo-related data for a specific user'

    def add_arguments(self, parser):
        parser.add_argument(
            '--user-email',
            type=str,
            required=True,
            help='Email of the user to clean up data for',
        )
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Confirm the deletion (required for safety)',
        )

    def handle(self, *args, **options):
        user_email = options['user_email']
        confirm = options['confirm']
        
        if not confirm:
            self.stdout.write(
                self.style.ERROR('Please add --confirm flag to confirm the deletion. This action cannot be undone!')
            )
            return
        
        try:
            user = User.objects.get(email=user_email)
        except User.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f'User not found: {user_email}')
            )
            return
        
        # Show current data count
        ativos_count = user.ativos.count()
        movimentacoes_count = Movimentacao.objects.filter(ativo__usuario=user).count()
        dividendos_count = Dividendo.objects.filter(ativo__usuario=user).count()
        evolucao_count = EvolucaoPatrimonial.objects.filter(ativo__usuario=user).count()
        
        self.stdout.write(f'Before cleanup for {user.email}:')
        self.stdout.write(f'  Ativos: {ativos_count}')
        self.stdout.write(f'  Movimentacoes: {movimentacoes_count}')
        self.stdout.write(f'  Dividendos: {dividendos_count}')
        self.stdout.write(f'  EvolucaoPatrimonial: {evolucao_count}')
        
        if ativos_count == 0:
            self.stdout.write(self.style.SUCCESS('No data to clean up.'))
            return
        
        # Delete in order (from dependent to independent)
        evolucao_deleted = EvolucaoPatrimonial.objects.filter(ativo__usuario=user).delete()
        dividendos_deleted = Dividendo.objects.filter(ativo__usuario=user).delete()
        movimentacoes_deleted = Movimentacao.objects.filter(ativo__usuario=user).delete()
        ativos_deleted = user.ativos.all().delete()
        
        self.stdout.write(f'Cleanup completed:')
        self.stdout.write(f'  EvolucaoPatrimonial deleted: {evolucao_deleted[0]} records')
        self.stdout.write(f'  Dividendos deleted: {dividendos_deleted[0]} records')
        self.stdout.write(f'  Movimentacoes deleted: {movimentacoes_deleted[0]} records')
        self.stdout.write(f'  Ativos deleted: {ativos_deleted[0]} records')
        
        # Verify cleanup
        self.stdout.write(f'After cleanup verification:')
        self.stdout.write(f'  Ativos: {user.ativos.count()}')
        self.stdout.write(f'  Movimentacoes: {Movimentacao.objects.filter(ativo__usuario=user).count()}')
        self.stdout.write(f'  Dividendos: {Dividendo.objects.filter(ativo__usuario=user).count()}')
        self.stdout.write(f'  EvolucaoPatrimonial: {EvolucaoPatrimonial.objects.filter(ativo__usuario=user).count()}')
        
        self.stdout.write(
            self.style.SUCCESS(f'Successfully cleaned up all data for user: {user_email}')
        ) 
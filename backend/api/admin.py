from django.core.management.base import BaseCommand
from api.models import User, Profile, Category


class Command(BaseCommand):
    help = 'Seeds the database with the admin account and default categories'

    def handle(self, *args, **kwargs):
        if not User.objects.filter(email='admin@sdpms.edu').exists():
            admin = User.objects.create_superuser(
                email='admin@sdpms.edu',
                password='Admin@2026',
                name='System Admin',
                role='admin',
            )
            admin.is_staff = True
            admin.is_superuser = True
            admin.save()
            Profile.objects.get_or_create(owner=admin)
            self.stdout.write(self.style.SUCCESS('Admin created: admin@sdpms.edu / Admin@2026'))
        else:
            self.stdout.write('Admin already exists.')

        defaults = [
            {'name': 'Arts',        'icon': 'fa-solid fa-palette',     'desc': 'Visual & creative arts'},
            {'name': 'IT',          'icon': 'fa-solid fa-laptop-code',  'desc': 'Information technology'},
            {'name': 'Engineering', 'icon': 'fa-solid fa-gear',          'desc': 'Engineering projects'},
            {'name': 'Nursing',     'icon': 'fa-solid fa-heart-pulse',   'desc': 'Health & nursing'},
        ]
        for cat in defaults:
            Category.objects.get_or_create(name=cat['name'], defaults={'icon': cat['icon'], 'desc': cat['desc']})
        self.stdout.write(self.style.SUCCESS('Default categories seeded.'))
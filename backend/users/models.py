import secrets
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin


class UserManager(BaseUserManager):
    def create_user(self, email, name, password=None, **extra):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, name=name, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, name, password=None, **extra):
        extra.setdefault('is_staff', True)
        extra.setdefault('is_superuser', True)
        extra.setdefault('role', 'lead')
        return self.create_user(email, name, password, **extra)


class Team(models.Model):
    name = models.CharField(max_length=200)
    lead = models.ForeignKey(
        'User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='led_teams'
    )
    github_pat = models.CharField(max_length=255, blank=True, default='')
    webhook_secret = models.CharField(max_length=200, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class Repository(models.Model):
    name = models.CharField(max_length=200) # e.g. owner/repo
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='repositories')
    invite_code = models.CharField(max_length=6, unique=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.invite_code:
            self.invite_code = secrets.token_hex(3).upper()
        super().save(*args, **kwargs)

    def regenerate_invite_code(self):
        self.invite_code = secrets.token_hex(3).upper()
        self.save()

    def __str__(self):
        return f'{self.name} ({self.team.name})'


class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [('lead', 'Lead'), ('tl', 'TL'), ('member', 'Member')]
    ROLE_TAG_CHOICES = [
        ('frontend', 'Frontend'), ('backend', 'Backend'),
        ('devops', 'DevOps'), ('fullstack', 'Full Stack'), ('', 'None'),
    ]

    email = models.EmailField(unique=True)
    name = models.CharField(max_length=200)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='member')
    avatar = models.CharField(max_length=500, blank=True, default='')
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    team = models.ForeignKey(Team, on_delete=models.SET_NULL, null=True, blank=True, related_name='all_members')
    repositories = models.ManyToManyField(Repository, related_name='users', blank=True)
    whatsapp_number = models.CharField(max_length=20, blank=True, default='')
    role_tag = models.CharField(max_length=20, choices=ROLE_TAG_CHOICES, blank=True, default='')
    invite_code_used = models.CharField(max_length=6, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']
    objects = UserManager()

    @property
    def is_lead(self):
        return self.role in ('lead', 'tl')

    def __str__(self):
        return f'{self.name} <{self.email}>'


class Notification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    issue = models.ForeignKey('issues.Issue', on_delete=models.CASCADE, null=True, blank=True, related_name='notifications')
    message = models.CharField(max_length=500)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'To {self.user.name}: {self.message}'


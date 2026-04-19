from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError('Email required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault('role', 'admin')
        extra.setdefault('is_staff', True)
        extra.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    ROLES = [('admin', 'Admin'), ('student', 'Student')]
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=200)
    role = models.CharField(max_length=20, choices=ROLES, default='student')
    dob = models.DateField(null=True, blank=True)
    sex = models.CharField(max_length=30, blank=True)
    address = models.TextField(blank=True)
    program = models.CharField(max_length=200, blank=True)
    bio = models.TextField(blank=True)
    skills = models.TextField(blank=True)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    cover = models.ImageField(upload_to='covers/', null=True, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    last_active = models.DateTimeField(auto_now=True)
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']
    objects = UserManager()

    def __str__(self):
        return self.email


class Project(models.Model):
    STATUS_CHOICES = [('Completed', 'Completed'), ('In Progress', 'In Progress'), ('Concept', 'Concept')]
    PRIVACY_CHOICES = [('public', 'Public'), ('unlisted', 'Unlisted'), ('private', 'Private')]
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='projects')
    title = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='Completed')
    privacy = models.CharField(max_length=20, choices=PRIVACY_CHOICES, default='public')
    image_url = models.TextField(blank=True)
    image_file = models.ImageField(upload_to='projects/', null=True, blank=True)
    github_url = models.URLField(blank=True)
    deploy_url = models.URLField(blank=True)
    figma_url = models.URLField(blank=True)
    adobe_url = models.URLField(blank=True)
    completion_date = models.DateField(null=True, blank=True)
    skills = models.JSONField(default=list)
    views = models.PositiveIntegerField(default=0)
    deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title

    @property
    def like_count(self):
        return self.likes.count()

    @property
    def comment_count(self):
        return self.comments.count()

    @property
    def effective_image(self):
        if self.image_file:
            return self.image_file.url
        return self.image_url or ''


class Like(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='likes')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='likes')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('project', 'user')


class Comment(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='comments')
    text = models.TextField()
    is_flagged = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']


class PortfolioDesign(models.Model):
    owner = models.OneToOneField(User, on_delete=models.CASCADE, related_name='portfolio_design')
    pages = models.JSONField(default=list)
    elements = models.JSONField(default=dict)
    bg = models.CharField(max_length=50, default='#ffffff')
    updated_at = models.DateTimeField(auto_now=True)


class Profile(models.Model):
    owner = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile_extra')
    about_bio = models.TextField(blank=True)
    about_interests = models.TextField(blank=True)
    about_languages = models.TextField(blank=True)
    about_github = models.URLField(blank=True)
    about_linkedin = models.URLField(blank=True)
    resume_data = models.JSONField(default=dict)
    resume_template = models.IntegerField(default=0)
    avatar_data_url = models.TextField(blank=True)
    cover_data_url = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)


class Template(models.Model):
    name = models.CharField(max_length=200)
    category = models.CharField(max_length=100, default='presentation')
    desc = models.TextField(blank=True)
    preview_icon = models.CharField(max_length=100, default='fa-solid fa-palette')
    color = models.CharField(max_length=20, default='#2563eb')
    elements = models.JSONField(default=list)
    pages = models.JSONField(default=list)
    bg = models.CharField(max_length=50, default='#ffffff')
    thumbnail = models.TextField(blank=True)
    deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class Announcement(models.Model):
    title = models.CharField(max_length=300)
    message = models.TextField()
    audience = models.CharField(max_length=20, default='all')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    icon = models.CharField(max_length=100, default='fa-solid fa-folder')
    desc = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ['name']


class SiteContent(models.Model):
    key = models.CharField(max_length=100, unique=True)
    value = models.TextField(blank=True)


class PortfolioView(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='portfolio_views')
    viewer_key = models.CharField(max_length=200)
    date = models.DateField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('owner', 'viewer_key', 'date')


class ProjectView(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='project_views')
    viewer_key = models.CharField(max_length=200)
    date = models.DateField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('project', 'viewer_key', 'date')


class Notification(models.Model):
    TYPES = [('view', 'View'), ('like', 'Like'), ('comment', 'Comment'), ('follow', 'Follow'), ('flag', 'Flag')]
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    sender_name = models.CharField(max_length=200, default='Someone')
    notif_type = models.CharField(max_length=20, choices=TYPES, default='view')
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class FlaggedContent(models.Model):
    comment = models.ForeignKey(Comment, on_delete=models.CASCADE, null=True, blank=True)
    reason = models.TextField()
    detected_words = models.TextField(blank=True)
    resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
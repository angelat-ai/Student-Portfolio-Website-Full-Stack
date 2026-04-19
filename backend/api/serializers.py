from rest_framework import serializers
from .models import User, Project, Like, Comment, PortfolioDesign, Profile, Template, Announcement, Category, SiteContent, Notification, FlaggedContent


class UserSerializer(serializers.ModelSerializer):
    age = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()
    cover_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id','email','name','role','dob','sex','address','program','bio','skills',
                  'avatar_url','cover_url','is_active','created_at','last_active','age']

    def get_age(self, obj):
        if not obj.dob: return None
        from datetime import date
        today = date.today()
        age = today.year - obj.dob.year
        if (today.month, today.day) < (obj.dob.month, obj.dob.day): age -= 1
        return age

    def get_avatar_url(self, obj):
        try:
            if obj.profile_extra.avatar_data_url: return obj.profile_extra.avatar_data_url
        except: pass
        if obj.avatar:
            request = self.context.get('request')
            if request: return request.build_absolute_uri(obj.avatar.url)
        return None

    def get_cover_url(self, obj):
        try:
            if obj.profile_extra.cover_data_url: return obj.profile_extra.cover_data_url
        except: pass
        if obj.cover:
            request = self.context.get('request')
            if request: return request.build_absolute_uri(obj.cover.url)
        return None


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ['email','name','password','dob','sex','address','role']
        extra_kwargs = {'role': {'default': 'student'}}

    def create(self, validated_data):
        password = validated_data.pop('password')
        validated_data['role'] = 'student'
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        Profile.objects.get_or_create(owner=user)
        return user


class CommentSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source='author.name', read_only=True)
    author_email = serializers.CharField(source='author.email', read_only=True)
    at = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = Comment
        fields = ['id','text','author_name','author_email','at','is_flagged']


class ProjectSerializer(serializers.ModelSerializer):
    owner = serializers.IntegerField(source='owner.id', read_only=True)
    owner_name = serializers.CharField(source='owner.name', read_only=True)
    owner_email = serializers.CharField(source='owner.email', read_only=True)
    owner_avatar = serializers.SerializerMethodField()
    like_count = serializers.ReadOnlyField()
    comment_count = serializers.ReadOnlyField()
    liked_by_me = serializers.SerializerMethodField()
    effective_image = serializers.SerializerMethodField()
    comments = CommentSerializer(many=True, read_only=True)

    class Meta:
        model = Project
        fields = ['id','title','description','category','status','privacy',
                  'image_url','github_url','deploy_url','figma_url','adobe_url',
                  'completion_date','skills','views','deleted','deleted_at',
                  'created_at','updated_at','owner','owner_name','owner_email','owner_avatar',
                  'like_count','comment_count','liked_by_me','effective_image','comments']

    def get_owner_avatar(self, obj):
        try:
            if obj.owner.profile_extra.avatar_data_url: return obj.owner.profile_extra.avatar_data_url
        except: pass
        return None

    def get_liked_by_me(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(user=request.user).exists()
        return False

    def get_effective_image(self, obj):
        if obj.image_file:
            request = self.context.get('request')
            if request: return request.build_absolute_uri(obj.image_file.url)
            return obj.image_file.url
        return obj.image_url or ''


class PortfolioDesignSerializer(serializers.ModelSerializer):
    class Meta:
        model = PortfolioDesign
        fields = ['pages','elements','bg','updated_at']


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ['about_bio','about_interests','about_languages','about_github','about_linkedin',
                  'resume_data','resume_template','avatar_data_url','cover_data_url']


class TemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Template
        fields = '__all__'


class AnnouncementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Announcement
        fields = '__all__'


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'


class SiteContentSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteContent
        fields = '__all__'


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = '__all__'


class FlaggedContentSerializer(serializers.ModelSerializer):
    comment_text = serializers.CharField(source='comment.text', read_only=True)
    author_name = serializers.CharField(source='comment.author.name', read_only=True)
    author_email = serializers.CharField(source='comment.author.email', read_only=True)
    project_title = serializers.CharField(source='comment.project.title', read_only=True)

    class Meta:
        model = FlaggedContent
        fields = '__all__'
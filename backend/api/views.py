from django.utils import timezone
from django.db.models import Count
from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from .models import (User, Project, Like, Comment, PortfolioDesign, Profile,
                     Template, Announcement, Category, SiteContent, PortfolioView)
from .serializers import (UserSerializer, RegisterSerializer, ProjectSerializer,
                           CommentSerializer, PortfolioDesignSerializer, ProfileSerializer,
                           TemplateSerializer, AnnouncementSerializer, CategorySerializer,
                           SiteContentSerializer)


def get_tokens(user):
    refresh = RefreshToken.for_user(user)
    return {'refresh': str(refresh), 'access': str(refresh.access_token)}


@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    ser = RegisterSerializer(data=request.data)
    if ser.is_valid():
        user = ser.save()
        return Response({'tokens': get_tokens(user), 'user': UserSerializer(user).data}, status=201)
    return Response(ser.errors, status=400)


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    email = request.data.get('email', '').lower().strip()
    password = request.data.get('password', '')
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response({'detail': 'Invalid credentials.'}, status=400)
    if not user.check_password(password):
        return Response({'detail': 'Invalid credentials.'}, status=400)
    if not user.is_active:
        return Response({'detail': 'Account suspended.'}, status=403)
    return Response({'tokens': get_tokens(user), 'user': UserSerializer(user).data})


@api_view(['GET'])
def me(request):
    return Response(UserSerializer(request.user, context={'request': request}).data)


@api_view(['PATCH'])
def update_me(request):
    user = request.user
    allowed = ['name', 'dob', 'sex', 'address', 'program', 'bio', 'skills']
    for field in allowed:
        if field in request.data:
            setattr(user, field, request.data[field])
    if 'password' in request.data and request.data['password']:
        user.set_password(request.data['password'])
    user.save()
    return Response(UserSerializer(user, context={'request': request}).data)


@api_view(['GET', 'PATCH'])
def profile(request):
    user = request.user
    obj, _ = Profile.objects.get_or_create(owner=user)
    if request.method == 'GET':
        return Response(ProfileSerializer(obj).data)
    ser = ProfileSerializer(obj, data=request.data, partial=True)
    if ser.is_valid():
        ser.save()
        return Response(ser.data)
    return Response(ser.errors, status=400)


@api_view(['GET'])
@permission_classes([AllowAny])
def public_profile(request, user_id):
    try:
        user = User.objects.get(id=user_id, is_active=True)
    except User.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=404)
    profile_data = UserSerializer(user, context={'request': request}).data
    try:
        extra = ProfileSerializer(user.profile_extra).data
    except Profile.DoesNotExist:
        extra = {}
    try:
        design = PortfolioDesignSerializer(user.portfolio_design).data
    except PortfolioDesign.DoesNotExist:
        design = None
    projects = Project.objects.filter(owner=user, deleted=False, privacy='public')
    projects_data = ProjectSerializer(projects, many=True, context={'request': request}).data
    return Response({'user': profile_data, 'extra': extra, 'design': design, 'projects': projects_data})


@api_view(['GET', 'POST'])
def projects(request):
    if request.method == 'GET':
        qs = Project.objects.filter(owner=request.user)
        include_deleted = request.query_params.get('include_deleted', 'false')
        if include_deleted != 'true':
            qs = qs.filter(deleted=False)
        return Response(ProjectSerializer(qs, many=True, context={'request': request}).data)

    data = request.data.copy()
    skills = data.get('skills', [])
    if isinstance(skills, str):
        import json
        try:
            skills = json.loads(skills)
        except Exception:
            skills = [s.strip() for s in skills.split(',') if s.strip()]
    proj = Project.objects.create(
        owner=request.user,
        title=data.get('title', ''),
        description=data.get('description', ''),
        category=data.get('category', ''),
        status=data.get('status', 'Completed'),
        privacy=data.get('privacy', 'public'),
        image_url=data.get('image_url', ''),
        github_url=data.get('githubUrl', ''),
        deploy_url=data.get('deployUrl', ''),
        figma_url=data.get('figmaUrl', ''),
        adobe_url=data.get('adobeUrl', ''),
        completion_date=data.get('completion_date') or None,
        skills=skills,
    )
    if 'image_file' in request.FILES:
        proj.image_file = request.FILES['image_file']
        proj.save()
    return Response(ProjectSerializer(proj, context={'request': request}).data, status=201)


@api_view(['GET', 'PATCH', 'DELETE'])
def project_detail(request, pk):
    try:
        proj = Project.objects.get(pk=pk, owner=request.user)
    except Project.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=404)

    if request.method == 'GET':
        return Response(ProjectSerializer(proj, context={'request': request}).data)

    if request.method == 'PATCH':
        data = request.data
        fields = ['title', 'description', 'category', 'status', 'privacy',
                  'image_url', 'github_url', 'deploy_url', 'figma_url', 'adobe_url', 'completion_date']
        mapping = {'githubUrl': 'github_url', 'deployUrl': 'deploy_url',
                   'figmaUrl': 'figma_url', 'adobeUrl': 'adobe_url'}
        for k, v in mapping.items():
            if k in data:
                setattr(proj, v, data[k])
        for f in fields:
            if f in data:
                setattr(proj, f, data[f] or (None if f == 'completion_date' else ''))
        if 'skills' in data:
            skills = data['skills']
            if isinstance(skills, str):
                import json
                try:
                    skills = json.loads(skills)
                except Exception:
                    skills = [s.strip() for s in skills.split(',') if s.strip()]
            proj.skills = skills
        if 'image_file' in request.FILES:
            proj.image_file = request.FILES['image_file']
        proj.save()
        return Response(ProjectSerializer(proj, context={'request': request}).data)

    if request.method == 'DELETE':
        action = request.query_params.get('action', 'soft')
        if action == 'restore':
            proj.deleted = False
            proj.deleted_at = None
            proj.save()
            return Response({'status': 'restored'})
        elif action == 'permanent':
            proj.delete()
            return Response({'status': 'deleted'}, status=204)
        else:
            proj.deleted = True
            proj.deleted_at = timezone.now()
            proj.save()
            return Response({'status': 'trashed'})


@api_view(['POST'])
def increment_project_views(request, pk):
    try:
        proj = Project.objects.get(pk=pk, deleted=False)
    except Project.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=404)
    if proj.owner != request.user:
        proj.views += 1
        proj.save(update_fields=['views'])
    return Response({'views': proj.views})


@api_view(['GET'])
@permission_classes([AllowAny])
def discover(request):
    qs = Project.objects.filter(deleted=False, privacy='public').select_related('owner')
    category = request.query_params.get('category')
    if category and category != 'All':
        qs = qs.filter(category=category)
    sort = request.query_params.get('sort', 'recent')
    if sort == 'popular':
        qs = qs.annotate(like_cnt=Count('likes')).order_by('-like_cnt', '-created_at')
    elif sort == 'views':
        qs = qs.order_by('-views', '-created_at')
    else:
        qs = qs.order_by('-created_at')
    return Response(ProjectSerializer(qs, many=True, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([AllowAny])
def top_projects(request):
    qs = Project.objects.filter(deleted=False, privacy='public').order_by('-views', '-created_at')[:6]
    return Response(ProjectSerializer(qs, many=True, context={'request': request}).data)


@api_view(['POST'])
def toggle_like(request, pk):
    try:
        proj = Project.objects.get(pk=pk, deleted=False)
    except Project.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=404)
    like, created = Like.objects.get_or_create(project=proj, user=request.user)
    if not created:
        like.delete()
        liked = False
    else:
        liked = True
    return Response({'liked': liked, 'count': proj.likes.count()})


@api_view(['GET', 'POST'])
def comments(request, pk):
    try:
        proj = Project.objects.get(pk=pk, deleted=False)
    except Project.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=404)
    if request.method == 'GET':
        return Response(CommentSerializer(proj.comments.all(), many=True).data)
    c = Comment.objects.create(project=proj, author=request.user, text=request.data.get('text', ''))
    return Response(CommentSerializer(c).data, status=201)


@api_view(['GET', 'POST'])
def portfolio_design(request):
    obj, _ = PortfolioDesign.objects.get_or_create(
        owner=request.user,
        defaults={'pages': ['Page 1'], 'elements': {'0': []}, 'bg': '#1a2744'}
    )
    if request.method == 'GET':
        return Response(PortfolioDesignSerializer(obj).data)
    obj.pages = request.data.get('pages', obj.pages)
    obj.elements = request.data.get('elements', obj.elements)
    obj.bg = request.data.get('bg', obj.bg)
    obj.save()
    return Response(PortfolioDesignSerializer(obj).data)


@api_view(['POST'])
def increment_portfolio_view(request, user_id):
    try:
        owner = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=404)
    if request.user == owner:
        return Response({'status': 'self'})
    viewer_key = f'user_{request.user.id}' if request.user.is_authenticated else f'anon_{request.META.get("REMOTE_ADDR", "")}'
    from datetime import date
    PortfolioView.objects.get_or_create(owner=owner, viewer_key=viewer_key, date=date.today())
    count = PortfolioView.objects.filter(owner=owner).count()
    return Response({'views': count})


@api_view(['GET'])
def student_stats(request):
    user = request.user
    project_count = Project.objects.filter(owner=user, deleted=False).count()
    portfolio_views = PortfolioView.objects.filter(owner=user).count()
    return Response({'projects': project_count, 'views': portfolio_views, 'clicks': 0, 'reviews': 0})


@api_view(['GET'])
@permission_classes([AllowAny])
def templates(request):
    qs = Template.objects.filter(deleted=False)
    category = request.query_params.get('category')
    if category and category != 'all':
        qs = qs.filter(category=category)
    return Response(TemplateSerializer(qs, many=True).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_template(request):
    if request.user.role != 'admin':
        return Response({'detail': 'Admin only.'}, status=403)
    ser = TemplateSerializer(data=request.data)
    if ser.is_valid():
        ser.save()
        return Response(ser.data, status=201)
    return Response(ser.errors, status=400)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def template_detail(request, pk):
    if request.user.role != 'admin':
        return Response({'detail': 'Admin only.'}, status=403)
    try:
        tpl = Template.objects.get(pk=pk)
    except Template.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=404)
    if request.method == 'PATCH':
        ser = TemplateSerializer(tpl, data=request.data, partial=True)
        if ser.is_valid():
            ser.save()
            return Response(ser.data)
        return Response(ser.errors, status=400)
    action = request.query_params.get('action', 'soft')
    if action == 'restore':
        tpl.deleted = False
        tpl.deleted_at = None
        tpl.save()
        return Response({'status': 'restored'})
    elif action == 'permanent':
        tpl.delete()
        return Response(status=204)
    else:
        tpl.deleted = True
        tpl.deleted_at = timezone.now()
        tpl.save()
        return Response({'status': 'trashed'})


@api_view(['GET'])
@permission_classes([AllowAny])
def trashed_templates(request):
    if not request.user.is_authenticated or request.user.role != 'admin':
        return Response({'detail': 'Admin only.'}, status=403)
    return Response(TemplateSerializer(Template.objects.filter(deleted=True), many=True).data)


@api_view(['GET', 'POST'])
def announcements(request):
    if request.method == 'GET':
        return Response(AnnouncementSerializer(Announcement.objects.all(), many=True).data)
    if request.user.role != 'admin':
        return Response({'detail': 'Admin only.'}, status=403)
    ser = AnnouncementSerializer(data=request.data)
    if ser.is_valid():
        ser.save()
        return Response(ser.data, status=201)
    return Response(ser.errors, status=400)


@api_view(['GET', 'POST', 'DELETE'])
def categories(request):
    if request.method == 'GET':
        return Response(CategorySerializer(Category.objects.all(), many=True).data)
    if request.user.role != 'admin':
        return Response({'detail': 'Admin only.'}, status=403)
    if request.method == 'POST':
        ser = CategorySerializer(data=request.data)
        if ser.is_valid():
            ser.save()
            return Response(ser.data, status=201)
        return Response(ser.errors, status=400)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def category_detail(request, pk):
    if request.user.role != 'admin':
        return Response({'detail': 'Admin only.'}, status=403)
    try:
        Category.objects.get(pk=pk).delete()
    except Category.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=404)
    return Response(status=204)


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def site_content(request):
    if request.method == 'GET':
        items = SiteContent.objects.all()
        return Response({item.key: item.value for item in items})
    if not request.user.is_authenticated or request.user.role != 'admin':
        return Response({'detail': 'Admin only.'}, status=403)
    for key, value in request.data.items():
        SiteContent.objects.update_or_create(key=key, defaults={'value': str(value)})
    return Response({'status': 'saved'})


@api_view(['GET'])
def admin_stats(request):
    if request.user.role != 'admin':
        return Response({'detail': 'Admin only.'}, status=403)
    total_views = PortfolioView.objects.count()
    return Response({
        'users': User.objects.count(),
        'projects': Project.objects.filter(deleted=False).count(),
        'views': total_views,
        'flags': 0,
    })


@api_view(['GET'])
def admin_users(request):
    if request.user.role != 'admin':
        return Response({'detail': 'Admin only.'}, status=403)
    search = request.query_params.get('search', '')
    qs = User.objects.all()
    if search:
        qs = qs.filter(name__icontains=search) | User.objects.filter(email__icontains=search)
    return Response(UserSerializer(qs.distinct(), many=True, context={'request': request}).data)


@api_view(['POST'])
def admin_create_user(request):
    if request.user.role != 'admin':
        return Response({'detail': 'Admin only.'}, status=403)
    data = request.data.copy()
    password = data.pop('password', 'changeme123')
    try:
        user = User.objects.create_user(
            email=data['email'].lower().strip(),
            password=password,
            name=data.get('name', ''),
            role=data.get('role', 'student'),
            dob=data.get('dob') or None,
            sex=data.get('sex', ''),
            address=data.get('address', ''),
        )
        Profile.objects.get_or_create(owner=user)
        return Response(UserSerializer(user, context={'request': request}).data, status=201)
    except Exception as e:
        return Response({'detail': str(e)}, status=400)


@api_view(['PATCH'])
def admin_update_user(request, pk):
    if request.user.role != 'admin':
        return Response({'detail': 'Admin only.'}, status=403)
    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=404)
    allowed = ['name', 'dob', 'sex', 'address', 'role', 'is_active']
    for f in allowed:
        if f in request.data:
            setattr(user, f, request.data[f])
    if 'email' in request.data:
        user.email = request.data['email'].lower().strip()
    if 'password' in request.data and request.data['password']:
        user.set_password(request.data['password'])
    user.save()
    return Response(UserSerializer(user, context={'request': request}).data)


@api_view(['PATCH'])
def toggle_suspend(request, pk):
    if request.user.role != 'admin':
        return Response({'detail': 'Admin only.'}, status=403)
    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=404)
    user.is_active = not user.is_active
    user.save()
    return Response({'is_active': user.is_active})
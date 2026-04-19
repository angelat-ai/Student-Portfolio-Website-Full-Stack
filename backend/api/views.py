from django.utils import timezone
from django.db.models import Count, Q
from datetime import date, timedelta
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from .models import (User, Project, Like, Comment, PortfolioDesign, Profile,
                     Template, Announcement, Category, SiteContent, PortfolioView,
                     ProjectView, Notification, FlaggedContent)
from .serializers import (UserSerializer, RegisterSerializer, ProjectSerializer,
                           CommentSerializer, PortfolioDesignSerializer, ProfileSerializer,
                           TemplateSerializer, AnnouncementSerializer, CategorySerializer,
                           SiteContentSerializer, NotificationSerializer, FlaggedContentSerializer)

BAD_WORDS = [
    'putang', 'puta', 'gago', 'bobo', 'tanga', 'ulol', 'leche', 'hindot', 'pakyu',
    'bwisit', 'inutil', 'siraulo', 'hayop', 'animal', 'pesteng', 'punyeta',
    'yawa', 'buang', 'atay', 'pisti', 'bogo', 'ungo', 'luod', 'hubag',
    'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'damn', 'crap', 'dick',
    'pussy', 'nigger', 'faggot', 'retard', 'idiot', 'stupid', 'moron',
]

def contains_bad_words(text):
    text_lower = text.lower()
    return [w for w in BAD_WORDS if w in text_lower]

def get_tokens(user):
    refresh = RefreshToken.for_user(user)
    return {'refresh': str(refresh), 'access': str(refresh.access_token)}

def get_viewer_key(request):
    if request.user.is_authenticated:
        return f'user_{request.user.id}'
    return f'anon_{request.META.get("REMOTE_ADDR", "unknown")}'

def create_notification(recipient, sender_name, notif_type, message):
    if recipient:
        Notification.objects.create(recipient=recipient, sender_name=sender_name, notif_type=notif_type, message=message)

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
        return Response({'detail': 'Invalid email or password.'}, status=400)
    if not user.check_password(password):
        return Response({'detail': 'Invalid email or password.'}, status=400)
    if not user.is_active:
        return Response({'detail': 'Account suspended.'}, status=403)
    return Response({'tokens': get_tokens(user), 'user': UserSerializer(user).data})

@api_view(['POST'])
@permission_classes([AllowAny])
def token_refresh(request):
    try:
        refresh = RefreshToken(request.data.get('refresh'))
        return Response({'access': str(refresh.access_token)})
    except Exception:
        return Response({'detail': 'Invalid refresh token.'}, status=400)

@api_view(['GET'])
def me(request):
    return Response(UserSerializer(request.user, context={'request': request}).data)

@api_view(['PATCH'])
def update_me(request):
    user = request.user
    for field in ['name', 'dob', 'sex', 'address', 'program', 'bio', 'skills']:
        if field in request.data:
            setattr(user, field, request.data[field])
    if 'password' in request.data and request.data['password']:
        user.set_password(request.data['password'])
    user.save()
    return Response(UserSerializer(user, context={'request': request}).data)

@api_view(['GET', 'PATCH'])
def profile(request):
    obj, _ = Profile.objects.get_or_create(owner=request.user)
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
    viewer_key = get_viewer_key(request)
    if not request.user.is_authenticated or request.user.id != user_id:
        pv, created = PortfolioView.objects.get_or_create(owner=user, viewer_key=viewer_key, date=date.today())
        if created:
            create_notification(user, 'Someone', 'view', 'Someone viewed your portfolio!')
    try:
        extra = ProfileSerializer(user.profile_extra).data
    except Profile.DoesNotExist:
        extra = {}
    try:
        design = PortfolioDesignSerializer(user.portfolio_design).data
    except PortfolioDesign.DoesNotExist:
        design = None
    projects = Project.objects.filter(owner=user, deleted=False, privacy='public')
    return Response({
        'user': UserSerializer(user, context={'request': request}).data,
        'extra': extra,
        'design': design,
        'projects': ProjectSerializer(projects, many=True, context={'request': request}).data,
    })

@api_view(['GET', 'POST'])
def projects(request):
    if request.method == 'GET':
        qs = Project.objects.filter(owner=request.user)
        if request.query_params.get('include_deleted') != 'true':
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
        mapping = {'githubUrl': 'github_url', 'deployUrl': 'deploy_url', 'figmaUrl': 'figma_url', 'adobeUrl': 'adobe_url'}
        for k, v in mapping.items():
            if k in data:
                setattr(proj, v, data[k])
        for f in ['title', 'description', 'category', 'status', 'privacy', 'image_url', 'github_url', 'deploy_url', 'figma_url', 'adobe_url', 'completion_date']:
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
@permission_classes([AllowAny])
def increment_project_views(request, pk):
    try:
        proj = Project.objects.get(pk=pk, deleted=False)
    except Project.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=404)
    viewer_key = get_viewer_key(request)
    pv, created = ProjectView.objects.get_or_create(project=proj, viewer_key=viewer_key, date=date.today())
    if created:
        proj.views += 1
        proj.save(update_fields=['views'])
        if proj.owner != request.user:
            create_notification(proj.owner, 'Someone', 'view', f'Someone viewed your project "{proj.title}"!')
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
        if proj.owner != request.user:
            create_notification(proj.owner, request.user.name, 'like', f'{request.user.name} liked your project "{proj.title}"!')
    return Response({'liked': liked, 'count': proj.likes.count()})

@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def comments(request, pk):
    try:
        proj = Project.objects.get(pk=pk, deleted=False)
    except Project.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=404)
    if request.method == 'GET':
        return Response(CommentSerializer(proj.comments.all(), many=True).data)
    if not request.user.is_authenticated:
        return Response({'detail': 'Login required.'}, status=401)
    text = request.data.get('text', '')
    bad = contains_bad_words(text)
    c = Comment.objects.create(project=proj, author=request.user, text=text, is_flagged=bool(bad))
    if bad:
        FlaggedContent.objects.create(comment=c, reason='Auto-detected inappropriate language', detected_words=', '.join(bad))
    if proj.owner != request.user:
        create_notification(proj.owner, request.user.name, 'comment', f'{request.user.name} commented on "{proj.title}": {text[:50]}')
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
@permission_classes([AllowAny])
def increment_portfolio_view(request, user_id):
    try:
        owner = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=404)
    viewer_key = get_viewer_key(request)
    if not request.user.is_authenticated or request.user.id != owner.id:
        pv, created = PortfolioView.objects.get_or_create(owner=owner, viewer_key=viewer_key, date=date.today())
        if created:
            create_notification(owner, 'Someone', 'view', 'Someone viewed your portfolio!')
    count = PortfolioView.objects.filter(owner=owner).count()
    return Response({'views': count})

@api_view(['GET'])
def student_stats(request):
    user = request.user
    project_count = Project.objects.filter(owner=user, deleted=False).count()
    portfolio_views = PortfolioView.objects.filter(owner=user).count()
    project_views = ProjectView.objects.filter(project__owner=user).count()
    total_views = portfolio_views + project_views
    today = date.today()
    views_by_day = []
    for i in range(30):
        d = today - timedelta(days=i)
        pv = PortfolioView.objects.filter(owner=user, date=d).count()
        prv = ProjectView.objects.filter(project__owner=user, date=d).count()
        views_by_day.append({'date': str(d), 'views': pv + prv})
    views_by_day.reverse()
    return Response({
        'projects': project_count,
        'views': total_views,
        'clicks': total_views,
        'reviews': 0,
        'views_by_day': views_by_day,
    })

@api_view(['GET'])
@permission_classes([AllowAny])
def templates(request):
    qs = Template.objects.filter(deleted=False)
    category = request.query_params.get('category')
    if category and category != 'all':
        qs = qs.filter(category=category)
    return Response(TemplateSerializer(qs, many=True).data)

@api_view(['POST'])
def create_template(request):
    if request.user.role != 'admin':
        return Response({'detail': 'Admin only.'}, status=403)
    ser = TemplateSerializer(data=request.data)
    if ser.is_valid():
        ser.save()
        return Response(ser.data, status=201)
    return Response(ser.errors, status=400)

@api_view(['PATCH', 'DELETE'])
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
    ser = CategorySerializer(data=request.data)
    if ser.is_valid():
        ser.save()
        return Response(ser.data, status=201)
    return Response(ser.errors, status=400)

@api_view(['DELETE'])
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
    today = date.today()
    users_today = User.objects.filter(created_at__date=today).count()
    projects_today = Project.objects.filter(created_at__date=today, deleted=False).count()
    total_views = PortfolioView.objects.count() + ProjectView.objects.count()
    flagged = FlaggedContent.objects.filter(resolved=False).count()
    views_by_day = []
    for i in range(30):
        d = today - timedelta(days=i)
        pv = PortfolioView.objects.filter(date=d).count()
        prv = ProjectView.objects.filter(date=d).count()
        views_by_day.append({'date': str(d), 'views': pv + prv})
    views_by_day.reverse()
    category_stats = list(
        Project.objects.filter(deleted=False)
        .values('category')
        .annotate(count=Count('id'))
        .order_by('-count')[:10]
    )
    return Response({
        'users': User.objects.count(),
        'projects': Project.objects.filter(deleted=False).count(),
        'views': total_views,
        'flags': flagged,
        'users_today': users_today,
        'projects_today': projects_today,
        'views_by_day': views_by_day,
        'category_stats': category_stats,
    })

@api_view(['GET'])
def admin_users(request):
    if request.user.role != 'admin':
        return Response({'detail': 'Admin only.'}, status=403)
    search = request.query_params.get('search', '')
    qs = User.objects.all().order_by('-created_at')
    if search:
        qs = qs.filter(Q(name__icontains=search) | Q(email__icontains=search))
    serialized = []
    for user in qs:
        Profile.objects.get_or_create(owner=user)
        serialized.append(UserSerializer(user, context={'request': request}).data)
    return Response(serialized)

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
    for f in ['name', 'dob', 'sex', 'address', 'role', 'is_active']:
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

@api_view(['GET'])
def notifications(request):
    notifs = Notification.objects.filter(recipient=request.user)[:20]
    return Response(NotificationSerializer(notifs, many=True).data)

@api_view(['POST'])
def mark_notifications_read(request):
    Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
    return Response({'status': 'ok'})

@api_view(['GET'])
def flagged_content(request):
    if request.user.role != 'admin':
        return Response({'detail': 'Admin only.'}, status=403)
    qs = FlaggedContent.objects.filter(resolved=False).select_related('comment', 'comment__author', 'comment__project')
    return Response(FlaggedContentSerializer(qs, many=True).data)

@api_view(['POST'])
def resolve_flag(request, pk):
    if request.user.role != 'admin':
        return Response({'detail': 'Admin only.'}, status=403)
    try:
        flag = FlaggedContent.objects.get(pk=pk)
    except FlaggedContent.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=404)
    action = request.data.get('action', 'resolve')
    if action == 'delete' and flag.comment:
        flag.comment.delete()
    flag.resolved = True
    flag.save()
    return Response({'status': 'resolved'})

@api_view(['POST'])
@permission_classes([AllowAny])
def setup_admin(request):
    email = request.data.get('email')
    password = request.data.get('password')
    name = request.data.get('name', 'Admin')
    if not email or not password:
        return Response({'detail': 'Email and password required.'}, status=400)
    if User.objects.filter(role='admin').exists():
        return Response({'detail': 'Admin already exists.'}, status=400)
    user, _ = User.objects.get_or_create(email=email.lower().strip())
    user.name = name
    user.role = 'admin'
    user.is_staff = True
    user.set_password(password)
    user.save()
    Profile.objects.get_or_create(owner=user)
    return Response({'status': 'Admin created!', 'tokens': get_tokens(user)})
from django.urls import path
from . import views

urlpatterns = [
    path('auth/register/', views.register, name='register'),
    path('auth/login/', views.login, name='login'),
    path('auth/me/', views.me, name='me'),
    path('auth/me/update/', views.update_me, name='update_me'),
    
    path('profile/', views.profile, name='profile'),
    path('profile/<int:user_id>/', views.public_profile, name='public_profile'),
    path('profile/<int:user_id>/view/', views.increment_portfolio_view, name='increment_portfolio_view'),
    
    path('projects/', views.projects, name='projects'),
    path('projects/<int:pk>/', views.project_detail, name='project_detail'),
    path('projects/<int:pk>/views/', views.increment_project_views, name='increment_project_views'),
    path('projects/<int:pk>/like/', views.toggle_like, name='toggle_like'),
    path('projects/<int:pk>/comments/', views.comments, name='comments'),
    
    path('discover/', views.discover, name='discover'),
    path('discover/top/', views.top_projects, name='top_projects'),
    
    path('portfolio/', views.portfolio_design, name='portfolio_design'),
    
    path('stats/', views.student_stats, name='student_stats'),
    
    path('templates/', views.templates, name='templates'),
    path('templates/create/', views.create_template, name='create_template'),
    path('templates/<int:pk>/', views.template_detail, name='template_detail'),
    path('templates/trashed/', views.trashed_templates, name='trashed_templates'),
    
    path('announcements/', views.announcements, name='announcements'),
    
    path('categories/', views.categories, name='categories'),
    path('categories/<int:pk>/', views.category_detail, name='category_detail'),
    
    path('content/', views.site_content, name='site_content'),
    
    path('admin/stats/', views.admin_stats, name='admin_stats'),
    path('admin/users/', views.admin_users, name='admin_users'),
    path('admin/users/create/', views.admin_create_user, name='admin_create_user'),
    path('admin/users/<int:pk>/', views.admin_update_user, name='admin_update_user'),
    path('admin/users/<int:pk>/suspend/', views.toggle_suspend, name='toggle_suspend'),
]
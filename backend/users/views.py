from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from .models import User, Team, Repository, Notification
from .serializers import (
    UserSerializer, RegisterLeadSerializer, RegisterMemberSerializer,
    LoginSerializer, UpdateUserSerializer, TeamSerializer, RepositorySerializer
)


def get_tokens(user):
    refresh = RefreshToken.for_user(user)
    return {'refresh': str(refresh), 'access': str(refresh.access_token)}


class RegisterLeadView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        s = RegisterLeadSerializer(data=request.data)
        if not s.is_valid():
            return Response({'message': s.errors}, status=400)
        d = s.validated_data

        if User.objects.filter(email=d['email']).exists():
            return Response({'message': 'Email already registered'}, status=400)

        user = User.objects.create_user(
            email=d['email'], name=d['name'], password=d['password'],
            role='lead', whatsapp_number=d.get('whatsapp_number', ''),
        )
        team = Team.objects.create(
            name=f"{d['name']}'s Team",
            lead=user,
        )
        user.team = team
        user.save()

        tokens = get_tokens(user)
        return Response({
            'message': 'Team Lead registered successfully',
            'user': UserSerializer(user).data,
            'team': TeamSerializer(team).data,
            **tokens,
        }, status=201)


class RegisterMemberView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        print("[RegisterMember] Raw request data:", request.data)
        s = RegisterMemberSerializer(data=request.data)
        if not s.is_valid():
            print("[RegisterMember] Serializer errors:", s.errors)
            return Response({'message': s.errors}, status=400)
        d = s.validated_data

        try:
            repo = Repository.objects.get(invite_code=d['invite_code'].upper())
            team = repo.team
        except Repository.DoesNotExist:
            return Response({'message': 'Invalid invite code — repository not found'}, status=404)

        if User.objects.filter(email=d['email']).exists():
            return Response({'message': 'Email already registered'}, status=400)

        user = User.objects.create_user(
            email=d['email'], name=d['name'], password=d['password'],
            role='member', team=team,
            whatsapp_number=d.get('whatsapp_number', ''),
            role_tag=d.get('role_tag', ''),
            invite_code_used=d['invite_code'].upper(),
        )
        user.repositories.add(repo)
        
        tokens = get_tokens(user)
        return Response({
            'message': 'Member registered successfully',
            'user': UserSerializer(user).data,
            'team': {'id': team.id, 'name': team.name},
            'repository': RepositorySerializer(repo).data,
            **tokens,
        }, status=201)


class LoginView(APIView):
    permission_classes = [AllowAny]
    # Strict rate limit for login — 5 attempts per minute per IP
    throttle_classes = []

    def post(self, request):
        from rest_framework.throttling import AnonRateThrottle

        s = LoginSerializer(data=request.data)
        if not s.is_valid():
            return Response({'message': 'Invalid email or password format'}, status=400)
        d = s.validated_data

        # Sanitize email
        email = d['email'].lower().strip()

        user = authenticate(request, username=email, password=d['password'])
        if not user:
            # Generic message — don't reveal whether email exists
            return Response({'message': 'Invalid email or password'}, status=401)
        if not user.is_active:
            return Response({'message': 'Account is deactivated. Contact your team lead.'}, status=403)

        tokens = get_tokens(user)
        user_data = UserSerializer(user).data
        return Response({'message': 'Login successful', 'user': user_data, **tokens})


class LogoutView(APIView):
    def post(self, request):
        try:
            refresh = request.data.get('refresh')
            if refresh:
                token = RefreshToken(refresh)
                token.blacklist()
        except Exception:
            pass
        return Response({'message': 'Logged out successfully'})


class NotificationListView(APIView):
    def get(self, request):
        notifications = request.user.notifications.filter(is_read=False).order_by('-created_at')[:50]
        data = [{
            'id': n.id,
            'message': n.message,
            'issue_id': n.issue.issue_id if n.issue else None,
            'created_at': n.created_at,
        } for n in notifications]
        return Response(data)


class NotificationReadView(APIView):
    def patch(self, request, pk):
        try:
            n = request.user.notifications.get(pk=pk)
            n.is_read = True
            n.save()
            return Response({'message': 'Notification marked as read'})
        except Notification.DoesNotExist:
            return Response({'message': 'Not found'}, status=404)


class NotificationReadAllView(APIView):
    def patch(self, request):
        request.user.notifications.filter(is_read=False).update(is_read=True)
        return Response({'message': 'All notifications marked as read'})


class MeView(APIView):
    def get(self, request):
        return Response({'user': UserSerializer(request.user).data})


class UserListView(APIView):
    def get(self, request):
        if not request.user.is_lead:
            return Response({'message': 'Team Lead access required'}, status=403)
        users = User.objects.all().order_by('-created_at')
        return Response(UserSerializer(users, many=True).data)


class UserDetailView(APIView):
    def get(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'message': 'User not found'}, status=404)
        return Response(UserSerializer(user).data)

    def patch(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'message': 'User not found'}, status=404)

        if not request.user.is_lead and request.user.pk != pk:
            return Response({'message': 'Forbidden'}, status=403)

        s = UpdateUserSerializer(user, data=request.data, partial=True)
        if not s.is_valid():
            return Response(s.errors, status=400)
        s.save()
        return Response(UserSerializer(user).data)

    def delete(self, request, pk):
        if not request.user.is_lead:
            return Response({'message': 'Team Lead access required'}, status=403)
        if request.user.pk == pk:
            return Response({'message': 'Cannot delete yourself'}, status=400)
        try:
            User.objects.get(pk=pk).delete()
        except User.DoesNotExist:
            return Response({'message': 'User not found'}, status=404)
        return Response({'message': 'User deleted'})


class UpdateMeView(APIView):
    def patch(self, request):
        s = UpdateUserSerializer(request.user, data=request.data, partial=True)
        if not s.is_valid():
            return Response(s.errors, status=400)
        s.save()
        return Response(UserSerializer(request.user).data)


class TeamRepositoryView(APIView):
    def get(self, request):
        if not request.user.team:
            return Response({'message': 'No team found'}, status=400)
            
        if request.user.is_lead:
            repos = request.user.team.repositories.all()
        else:
            repos = request.user.repositories.all()
            print("[TeamRepos] Member repos:", repos)
            
        return Response(RepositorySerializer(repos, many=True).data)

    def post(self, request):
        if not request.user.is_lead:
            return Response({'message': 'Team Lead access required'}, status=403)
        
        pat = request.data.get('github_pat', '').strip()
        repos = request.data.get('repositories', [])
        
        team = request.user.team
        if pat:
            team.github_pat = pat
            team.save()
            
        if not repos or not isinstance(repos, list):
            return Response({'message': 'Please provide a list of repository names'}, status=400)
            
        created_repos = []
        for repo_name in repos:
            repo, created = Repository.objects.get_or_create(
                name=repo_name.strip(),
                team=team
            )
            created_repos.append(repo)
            
        for repo in created_repos:
            request.user.repositories.add(repo)
            
        return Response({
            'message': 'Repositories saved successfully', 
            'repositories': RepositorySerializer(created_repos, many=True).data,
            'team': TeamSerializer(team).data
        })


class JoinRepositoryView(APIView):
    def post(self, request):
        invite_code = request.data.get('invite_code', '').strip().upper()
        if not invite_code:
            return Response({'message': 'Invite code is required'}, status=400)
            
        try:
            repo = Repository.objects.get(invite_code=invite_code)
        except Repository.DoesNotExist:
            return Response({'message': 'Invalid invite code — repository not found'}, status=404)
            
        if request.user.repositories.filter(id=repo.id).exists():
            return Response({'message': 'You are already a member of this repository'}, status=400)
            
        request.user.repositories.add(repo)
        return Response({
            'message': 'Joined repository successfully',
            'repository': RepositorySerializer(repo).data
        })

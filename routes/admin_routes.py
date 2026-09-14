from flask import Blueprint, request, jsonify, session
from services.auth_middleware import require_role
from services.user_service import (
    db_get_teacher_requests,
    db_approve_teacher_request,
    db_reject_teacher_request,
    db_get_login_history
)

admin_bp = Blueprint('admin_bp', __name__)

@admin_bp.route('/api/admin/teacher-requests', methods=['GET'])
@admin_bp.route('/api/admin/teacher-applications', methods=['GET'])
@require_role('admin')
def get_teacher_requests():
    status_filter = request.args.get('status', '').strip().lower()
    requests = db_get_teacher_requests(status_filter if status_filter else None)
    return jsonify({
        'requests': requests,
        'applications': requests
    }), 200

@admin_bp.route('/api/admin/teacher-requests/<user_id>/approve', methods=['POST'])
@admin_bp.route('/api/admin/teacher-applications/<user_id>/approve', methods=['POST'])
@require_role('admin')
def approve_teacher(user_id):
    admin_id = session.get('user_id')
    success, error = db_approve_teacher_request(user_id, admin_id=admin_id)
    if not success:
        status_code = 404 if 'not found' in (error or '').lower() else (403 if 'cannot approve' in (error or '').lower() else 400)
        return jsonify({'error': error}), status_code

    return jsonify({
        'message': 'Teacher approved successfully',
        'user_id': user_id,
        'role': 'teacher',
        'teacher_status': 'approved'
    }), 200

@admin_bp.route('/api/admin/teacher-requests/<user_id>/reject', methods=['POST'])
@admin_bp.route('/api/admin/teacher-applications/<user_id>/reject', methods=['POST'])
@require_role('admin')
def reject_teacher(user_id):
    admin_id = session.get('user_id')
    success, error = db_reject_teacher_request(user_id, admin_id=admin_id)
    if not success:
        status_code = 404 if 'not found' in (error or '').lower() else 400
        return jsonify({'error': error}), status_code

    return jsonify({
        'message': 'Teacher request rejected',
        'user_id': user_id,
        'role': 'student',
        'teacher_status': 'rejected'
    }), 200

@admin_bp.route('/api/admin/login-history', methods=['GET'])
@require_role('admin')
def get_login_history():
    role_filter = request.args.get('role', '').strip().lower()
    search = request.args.get('search', '').strip()
    data = db_get_login_history(role_filter if role_filter else None, search if search else None)
    return jsonify(data), 200

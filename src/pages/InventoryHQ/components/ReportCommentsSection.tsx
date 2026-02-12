import React, { useState, useEffect } from 'react';
import { InventoryService } from '../../../services/inventory';

interface ReportCommentsSectionProps {
    reportId: string;
    toast: any;
}

interface Comment {
    id: string;
    comment: string;
    created_at: string;
    updated_at: string;
    user_name: string;
    user_id: string;
}

const ReportCommentsSection: React.FC<ReportCommentsSectionProps> = ({ reportId, toast }) => {
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState('');

    useEffect(() => {
        loadComments();
    }, [reportId]);

    const loadComments = async () => {
        setLoading(true);
        try {
            const result = await InventoryService.getReportComments(reportId);
            if (result.success && result.comments) {
                setComments(result.comments);
            }
        } catch (error) {
            console.error('[Comments] Load error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddComment = async () => {
        if (!newComment.trim()) {
            toast.error('Vui lòng nhập nội dung bình luận');
            return;
        }

        setSubmitting(true);
        try {
            const result = await InventoryService.addReportComment(reportId, newComment);
            if (result.success) {
                toast.success('Đã thêm bình luận');
                setNewComment('');
                await loadComments();
            } else {
                toast.error(result.error || 'Không thể thêm bình luận');
            }
        } catch (error: any) {
            toast.error('Lỗi hệ thống: ' + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleStartEdit = (comment: Comment) => {
        setEditingId(comment.id);
        setEditText(comment.comment);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditText('');
    };

    const handleSaveEdit = async (commentId: string) => {
        if (!editText.trim()) {
            toast.error('Nội dung không được để trống');
            return;
        }

        try {
            const result = await InventoryService.updateReportComment(commentId, editText);
            if (result.success) {
                toast.success('Đã cập nhật bình luận');
                setEditingId(null);
                setEditText('');
                await loadComments();
            } else {
                toast.error(result.error || 'Không thể cập nhật');
            }
        } catch (error: any) {
            toast.error('Lỗi hệ thống: ' + error.message);
        }
    };

    const handleDelete = async (commentId: string) => {
        if (!confirm('Xác nhận xóa bình luận này?')) return;

        try {
            const result = await InventoryService.deleteReportComment(commentId);
            if (result.success) {
                toast.success('Đã xóa bình luận');
                await loadComments();
            } else {
                toast.error(result.error || 'Không thể xóa');
            }
        } catch (error: any) {
            toast.error('Lỗi hệ thống: ' + error.message);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Vừa xong';
        if (diffMins < 60) return `${diffMins} phút trước`;
        if (diffHours < 24) return `${diffHours} giờ trước`;
        if (diffDays < 7) return `${diffDays} ngày trước`;

        return date.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-600 text-2xl">comment</span>
                <h3 className="text-lg font-bold text-gray-900">
                    Bình luận ({comments.length})
                </h3>
            </div>

            {/* Add Comment */}
            <div className="bg-gray-50 rounded-lg p-4">
                <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Viết bình luận..."
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                    disabled={submitting}
                />
                <div className="flex justify-end mt-2">
                    <button
                        onClick={handleAddComment}
                        disabled={submitting || !newComment.trim()}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                    >
                        {submitting ? (
                            <>
                                <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                                <span>Đang gửi...</span>
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-xl">send</span>
                                <span>Gửi bình luận</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Comments List */}
            <div className="space-y-3">
                {loading ? (
                    // Loading skeleton
                    Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="bg-white rounded-lg p-4 border border-gray-200">
                            <div className="animate-pulse space-y-2">
                                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                                <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                            </div>
                        </div>
                    ))
                ) : comments.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                        <span className="material-symbols-outlined text-5xl mb-2">chat_bubble_outline</span>
                        <p className="text-sm">Chưa có bình luận nào</p>
                    </div>
                ) : (
                    comments.map((comment) => (
                        <div
                            key={comment.id}
                            className="bg-white rounded-lg p-4 border border-gray-200 hover:border-indigo-200 transition-colors"
                        >
                            {/* Comment Header */}
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                                        <span className="material-symbols-outlined text-indigo-600 text-lg">person</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-900">{comment.user_name}</p>
                                        <p className="text-xs text-gray-500">{formatDate(comment.created_at)}</p>
                                        {comment.updated_at !== comment.created_at && (
                                            <p className="text-xs text-gray-400 italic">Đã chỉnh sửa</p>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1">
                                    {editingId === comment.id ? (
                                        <>
                                            <button
                                                onClick={() => handleSaveEdit(comment.id)}
                                                className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                                                title="Lưu"
                                            >
                                                <span className="material-symbols-outlined text-xl">check</span>
                                            </button>
                                            <button
                                                onClick={handleCancelEdit}
                                                className="p-1 text-gray-600 hover:bg-gray-50 rounded transition-colors"
                                                title="Hủy"
                                            >
                                                <span className="material-symbols-outlined text-xl">close</span>
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => handleStartEdit(comment)}
                                                className="p-1 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                                title="Chỉnh sửa"
                                            >
                                                <span className="material-symbols-outlined text-lg">edit</span>
                                            </button>
                                            <button
                                                onClick={() => handleDelete(comment.id)}
                                                className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                title="Xóa"
                                            >
                                                <span className="material-symbols-outlined text-lg">delete</span>
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Comment Content */}
                            {editingId === comment.id ? (
                                <textarea
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    rows={2}
                                    className="w-full px-3 py-2 border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                                    autoFocus
                                />
                            ) : (
                                <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.comment}</p>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ReportCommentsSection;

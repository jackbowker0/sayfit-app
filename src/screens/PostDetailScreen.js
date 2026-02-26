// ============================================================
// POST DETAIL SCREEN — Single post with full comment thread
// Premium dark glass-morphism UI with Lucide icons.
// ============================================================

import React, { useState, useEffect, useContext } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FadeInView from '../components/FadeInView';
import { ChevronLeft, MessageCircle } from 'lucide-react-native';
import { TouchableOpacity } from 'react-native';

import { AuthContext } from '../context/AuthContext';
import FeedPostCard from '../components/FeedPostCard';
import CommentList from '../components/CommentList';
import GlassCard from '../components/GlassCard';
import { useTheme } from '../hooks/useTheme';
import { SPACING, FONT, RADIUS } from '../constants/theme';
import { likePost, unlikePost, getLikedPostIds, getComments, addComment, deleteComment } from '../services/social';

export default function PostDetailScreen({ navigation, route }) {
  const { user } = useContext(AuthContext);
  const { colors, isDark } = useTheme();
  const { post } = route.params;

  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [isLiked, setIsLiked] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [commentsResult, likedSet] = await Promise.all([
        getComments(post.id),
        getLikedPostIds([post.id]),
      ]);
      setComments(commentsResult.comments);
      setIsLiked(likedSet.has(post.id));
    } catch (e) {
      console.warn('[PostDetail] Load failed:', e);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleAddComment = async (body) => {
    const newComment = await addComment(post.id, body);
    setComments(prev => [...prev, newComment]);
  };

  const handleDeleteComment = async (commentId) => {
    await deleteComment(commentId);
    setComments(prev => prev.filter(c => c.id !== commentId));
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeft size={22} color={colors.textSecondary} strokeWidth={2} />
          <Text style={[styles.backText, { color: colors.textSecondary }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Post</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={{ flex: 1 }}>
        {/* Post */}
        <FadeInView delay={50} style={{ paddingHorizontal: SPACING.md }}>
          <FeedPostCard
            post={post}
            isLiked={isLiked}
            onLike={async (id) => { await likePost(id); setIsLiked(true); }}
            onUnlike={async (id) => { await unlikePost(id); setIsLiked(false); }}
            onUserPress={(userId) => navigation.navigate('UserProfile', { userId })}
          />
        </FadeInView>

        {/* Comments Section */}
        <FadeInView
          delay={150}
          style={[styles.commentsSection, { borderTopColor: colors.glassBorder }]}
        >
          <View style={styles.commentsTitleRow}>
            <MessageCircle size={14} color={colors.textMuted} strokeWidth={2} />
            <Text style={[styles.commentsTitle, { color: colors.textMuted }]}>COMMENTS</Text>
          </View>
          <CommentList
            comments={comments}
            loading={loadingComments}
            onAddComment={handleAddComment}
            onDeleteComment={handleDeleteComment}
            currentUserId={user?.id}
            onUserPress={(userId) => navigation.navigate('UserProfile', { userId })}
          />
        </FadeInView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 60,
  },
  backText: { ...FONT.body, fontWeight: '500' },
  title: { ...FONT.heading, textAlign: 'center' },
  commentsSection: {
    flex: 1,
    borderTopWidth: 1,
    marginTop: SPACING.sm,
  },
  commentsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  commentsTitle: {
    ...FONT.label,
  },
});

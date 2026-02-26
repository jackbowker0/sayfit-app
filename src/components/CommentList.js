// ============================================================
// COMMENT LIST — Comments section for a feed post
//
// Shows comments with user info and timestamps.
// Includes an input field for adding new comments.
// Premium dark UI with Lucide icons and glass-morphism.
// ============================================================

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Send, X, MessageCircle } from 'lucide-react-native';
import { useTheme } from '../hooks/useTheme';
import { SPACING, RADIUS, FONT, GLOW } from '../constants/theme';
import * as haptics from '../services/haptics';

function timeAgo(dateString) {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function CommentList({
  comments,
  loading,
  onAddComment,
  onDeleteComment,
  currentUserId,
  onUserPress,
}) {
  const { colors, isDark } = useTheme();
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim() || submitting) return;
    haptics.tap();
    setSubmitting(true);
    try {
      await onAddComment(text.trim());
      setText('');
    } catch (e) {
      console.warn('[Comments] Submit failed:', e);
    } finally {
      setSubmitting(false);
    }
  };

  const renderComment = ({ item }) => {
    const profile = item.profiles;
    const isOwn = profile?.id === currentUserId;

    return (
      <View style={[styles.comment, { borderBottomColor: colors.glassBorder }]}>
        <TouchableOpacity
          onPress={() => onUserPress?.(profile?.id)}
          activeOpacity={0.7}
        >
          <Text style={[styles.username, { color: colors.textPrimary }]}>
            {profile?.display_name || profile?.username || 'User'}
          </Text>
        </TouchableOpacity>
        <Text style={[styles.body, { color: colors.textSecondary }]}>{item.body}</Text>
        <View style={styles.commentMeta}>
          <Text style={[styles.time, { color: colors.textMuted }]}>{timeAgo(item.created_at)}</Text>
          {isOwn && (
            <TouchableOpacity
              style={styles.deleteRow}
              onPress={() => { haptics.tap(); onDeleteComment?.(item.id); }}
            >
              <X size={11} color={colors.red} />
              <Text style={[styles.deleteBtn, { color: colors.red }]}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={100}
    >
      {loading ? (
        <ActivityIndicator color={colors.textMuted} style={{ paddingVertical: 20 }} />
      ) : comments.length === 0 ? (
        <View style={styles.emptyState}>
          <MessageCircle size={28} color={colors.textDim} style={{ marginBottom: 8 }} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No comments yet. Be the first!</Text>
        </View>
      ) : (
        <FlatList
          data={comments}
          renderItem={renderComment}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          style={styles.list}
        />
      )}

      {/* Input */}
      <View style={[styles.inputRow, {
        backgroundColor: isDark ? colors.glassBg : colors.bgCard,
        borderTopColor: colors.glassBorder,
      }]}>
        <TextInput
          style={[styles.input, {
            backgroundColor: colors.bgInput,
            color: colors.textPrimary,
            borderColor: colors.glassBorder,
          }]}
          placeholder="Add a comment..."
          placeholderTextColor={colors.textDim}
          value={text}
          onChangeText={setText}
          maxLength={500}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, {
            backgroundColor: text.trim() ? colors.blue : colors.bgSubtle,
          }]}
          onPress={handleSubmit}
          disabled={!text.trim() || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Send
              size={16}
              color={text.trim() ? '#fff' : colors.textMuted}
            />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { flex: 1 },
  comment: {
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
  },
  username: {
    ...FONT.caption,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  body: {
    ...FONT.body,
    fontSize: 14,
    lineHeight: 20,
  },
  commentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  time: {
    ...FONT.caption,
    fontSize: 11,
  },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  deleteBtn: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    ...FONT.body,
    fontSize: 14,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    gap: 8,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 80,
  },
  sendBtn: {
    borderRadius: RADIUS.md,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

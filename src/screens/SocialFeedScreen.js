// ============================================================
// SOCIAL FEED SCREEN — Community tab showing workout posts
//
// Paginated FlatList of posts from followed users.
// Tabs for "Following" and "Explore" feeds.
// Premium dark glass-morphism UI with Lucide icons.
// ============================================================

import React, { useState, useEffect, useCallback, useContext, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FadeInView from '../components/FadeInView';
import { Users, Compass, CircleUser } from 'lucide-react-native';

import { AuthContext } from '../context/AuthContext';
import AuthGate from '../components/AuthGate';
import FeedPostCard from '../components/FeedPostCard';
import GlassCard from '../components/GlassCard';
import { useTheme } from '../hooks/useTheme';
import { SPACING, RADIUS, FONT, GLOW, TIMING } from '../constants/theme';
import { getFeed, getExploreFeed, likePost, unlikePost, getLikedPostIds } from '../services/social';
import * as haptics from '../services/haptics';

const TABS = [
  { key: 'following', label: 'Following', Icon: Users },
  { key: 'explore', label: 'Explore', Icon: Compass },
];

export default function SocialFeedScreen({ navigation }) {
  const { isAuthenticated } = useContext(AuthContext);
  const { colors, isDark } = useTheme();

  const [tab, setTab] = useState('following');
  const [posts, setPosts] = useState([]);
  const [likedIds, setLikedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Sliding tab indicator
  const tabIndex = useRef(new Animated.Value(0)).current;
  const [tabWidth, setTabWidth] = useState(0);

  const loadFeed = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);

      const fetchFn = tab === 'following' ? getFeed : getExploreFeed;
      const result = await fetchFn(null);
      setPosts(result.posts);
      setNextCursor(result.nextCursor);

      if (result.posts.length > 0) {
        const ids = result.posts.map(p => p.id);
        const liked = await getLikedPostIds(ids);
        setLikedIds(liked);
      }
    } catch (e) {
      console.warn('[SocialFeed] Load failed:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  useEffect(() => {
    if (isAuthenticated) loadFeed();
  }, [isAuthenticated, tab]);

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const fetchFn = tab === 'following' ? getFeed : getExploreFeed;
      const result = await fetchFn(nextCursor);
      const newPosts = [...posts, ...result.posts];
      setPosts(newPosts);
      setNextCursor(result.nextCursor);

      if (result.posts.length > 0) {
        const ids = result.posts.map(p => p.id);
        const liked = await getLikedPostIds(ids);
        setLikedIds(prev => new Set([...prev, ...liked]));
      }
    } catch (e) {
      console.warn('[SocialFeed] Load more failed:', e);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleLike = async (postId) => {
    await likePost(postId);
    setLikedIds(prev => new Set([...prev, postId]));
  };

  const handleUnlike = async (postId) => {
    await unlikePost(postId);
    setLikedIds(prev => {
      const next = new Set(prev);
      next.delete(postId);
      return next;
    });
  };

  const renderPost = ({ item, index }) => (
    <FadeInView delay={index * 60}>
      <FeedPostCard
        post={item}
        isLiked={likedIds.has(item.id)}
        onLike={handleLike}
        onUnlike={handleUnlike}
        onComment={(post) => navigation.navigate('PostDetail', { post })}
        onUserPress={(userId) => navigation.navigate('UserProfile', { userId })}
        onPostPress={(post) => navigation.navigate('PostDetail', { post })}
      />
    </FadeInView>
  );

  const renderEmpty = () => (
    <FadeInView delay={100} style={styles.emptyContainer}>
      <GlassCard style={styles.emptyCard}>
        <Users size={48} color={colors.textMuted} strokeWidth={1.2} />
        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
          {tab === 'following' ? 'Your feed is empty' : 'No posts yet'}
        </Text>
        <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
          {tab === 'following'
            ? 'Follow other users to see their workouts here, or check out the Explore tab.'
            : 'Be the first to share a workout!'}
        </Text>
        {tab === 'following' && (
          <TouchableOpacity
            style={[styles.emptyBtn, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder, borderWidth: 1 }]}
            onPress={() => {
              haptics.tap();
              Animated.timing(tabIndex, { toValue: 1 * tabWidth, duration: TIMING.normal, useNativeDriver: true }).start();
              setTab('explore');
            }}
          >
            <Compass size={16} color={colors.textPrimary} strokeWidth={2} />
            <Text style={[styles.emptyBtnText, { color: colors.textPrimary }]}>Explore</Text>
          </TouchableOpacity>
        )}
      </GlassCard>
    </FadeInView>
  );

  return (
    <AuthGate navigation={navigation}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Community</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('UserProfile', { userId: null })}
            style={[styles.profileBtn, {
              backgroundColor: colors.glassBg,
              borderColor: colors.glassBorder,
            }]}
          >
            <CircleUser size={20} color={colors.textSecondary} strokeWidth={1.8} />
          </TouchableOpacity>
        </View>

        {/* Glass Tab Switcher */}
        <View style={styles.tabBarOuter}>
          <View
            style={[styles.tabBar, {
              backgroundColor: colors.glassBg,
              borderColor: colors.glassBorder,
            }]}
            onLayout={(e) => setTabWidth(e.nativeEvent.layout.width / TABS.length)}
          >
            {/* Sliding indicator */}
            <Animated.View
              style={[
                styles.tabIndicator,
                {
                  width: tabWidth,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  transform: [{ translateX: tabIndex }],
                },
              ]}
            />
            {TABS.map((t, i) => (
              <TouchableOpacity
                key={t.key}
                style={styles.tab}
                onPress={() => {
                  haptics.tick();
                  Animated.timing(tabIndex, { toValue: i * tabWidth, duration: TIMING.normal, useNativeDriver: true }).start();
                  setTab(t.key);
                }}
              >
                <t.Icon
                  size={15}
                  color={tab === t.key ? colors.textPrimary : colors.textMuted}
                  strokeWidth={tab === t.key ? 2.2 : 1.8}
                />
                <Text style={[styles.tabText, {
                  color: tab === t.key ? colors.textPrimary : colors.textMuted,
                  fontWeight: tab === t.key ? '700' : '500',
                }]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Feed */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={colors.textMuted} size="large" />
          </View>
        ) : (
          <FlatList
            data={posts}
            renderItem={renderPost}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={renderEmpty}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadFeed(true)}
                tintColor={colors.textMuted}
              />
            }
            ListFooterComponent={loadingMore ? (
              <ActivityIndicator color={colors.textMuted} style={{ paddingVertical: 20 }} />
            ) : null}
          />
        )}
      </SafeAreaView>
    </AuthGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  title: {
    ...FONT.title,
  },
  profileBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  tabBarOuter: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    borderRadius: RADIUS.lg,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  tabText: {
    ...FONT.caption,
  },
  list: {
    paddingHorizontal: SPACING.md,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    paddingTop: 40,
    paddingHorizontal: SPACING.sm,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  emptyTitle: { ...FONT.heading, textAlign: 'center', marginTop: SPACING.md, marginBottom: SPACING.sm },
  emptyBody: { ...FONT.body, textAlign: 'center', marginBottom: SPACING.lg },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: RADIUS.round,
  },
  emptyBtnText: { fontSize: 15, fontWeight: '700' },
});

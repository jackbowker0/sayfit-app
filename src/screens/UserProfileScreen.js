// ============================================================
// USER PROFILE SCREEN — Public user profile with stats,
// recent posts, and follow button.
//
// If userId is null, shows the current user's own profile.
// Premium dark glass-morphism UI with Lucide icons.
// ============================================================

import React, { useState, useEffect, useContext } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FadeInView from '../components/FadeInView';
import { ChevronLeft, Flame, MoreHorizontal } from 'lucide-react-native';

import { AuthContext } from '../context/AuthContext';
import FeedPostCard from '../components/FeedPostCard';
import FollowButton from '../components/FollowButton';
import ProfileBadges from '../components/ProfileBadges';
import ReportSheet from '../components/ReportSheet';
import GlassCard from '../components/GlassCard';
import { useTheme } from '../hooks/useTheme';
import { COACHES } from '../constants/coaches';
import { COACH_ICONS } from '../constants/icons';
import { SPACING, RADIUS, FONT, GLOW } from '../constants/theme';
import { getProfile, getFollowCounts, isFollowing as checkFollowing } from '../services/profiles';
import { getUserPosts, likePost, unlikePost, getLikedPostIds } from '../services/social';
import { blockUser, muteUser } from '../services/moderation';
import { capture } from '../services/posthog';
import * as haptics from '../services/haptics';

export default function UserProfileScreen({ navigation, route }) {
  const { user } = useContext(AuthContext);
  const { colors, isDark } = useTheme();

  const targetUserId = route.params?.userId || user?.id;
  const isOwnProfile = targetUserId === user?.id;

  const [profile, setProfile] = useState(null);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [isFollowingUser, setIsFollowingUser] = useState(false);
  const [posts, setPosts] = useState([]);
  const [likedIds, setLikedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    if (targetUserId) loadProfile();
    capture('social_profile_viewed', { is_own_profile: isOwnProfile });
  }, [targetUserId]);

  const loadProfile = async () => {
    try {
      const [profileData, followCounts, postsResult] = await Promise.all([
        getProfile(targetUserId),
        getFollowCounts(targetUserId),
        getUserPosts(targetUserId),
      ]);

      setProfile(profileData);
      setCounts(followCounts);
      setPosts(postsResult.posts);

      if (!isOwnProfile) {
        const following = await checkFollowing(targetUserId);
        setIsFollowingUser(following);
      }

      if (postsResult.posts.length > 0) {
        const ids = postsResult.posts.map(p => p.id);
        const liked = await getLikedPostIds(ids);
        setLikedIds(liked);
      }
    } catch (e) {
      console.warn('[UserProfile] Load failed:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.textMuted} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <Text style={[styles.errorText, { color: colors.textMuted }]}>Profile not found</Text>
      </SafeAreaView>
    );
  }

  const coach = COACHES[profile.coach_id] || COACHES.hype;
  const CoachIcon = COACH_ICONS[coach.iconName] || COACH_ICONS.hype;

  const renderHeader = () => (
    <View style={styles.profileSection}>
      {/* Back button */}
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <ChevronLeft size={22} color={colors.textSecondary} strokeWidth={2} />
        <Text style={[styles.backText, { color: colors.textSecondary }]}>Back</Text>
      </TouchableOpacity>

      {/* Avatar */}
      <FadeInView delay={100}>
        <View style={[styles.avatar, { backgroundColor: coach.color + '20', borderColor: coach.color }]}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
          ) : (
            <CoachIcon size={32} color={coach.color} strokeWidth={2} />
          )}
        </View>
      </FadeInView>

      {/* Name + Username */}
      <FadeInView delay={150}>
        <Text style={[styles.displayName, { color: colors.textPrimary }]}>
          {profile.display_name || profile.username}
        </Text>
      </FadeInView>
      <Text style={[styles.username, { color: colors.textMuted }]}>@{profile.username}</Text>

      {/* Bio */}
      {profile.bio && (
        <Text style={[styles.bio, { color: colors.textSecondary }]}>{profile.bio}</Text>
      )}

      {/* Follow button + actions (not on own profile) */}
      {!isOwnProfile && (
        <View style={styles.followBtnContainer}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <FollowButton
              userId={targetUserId}
              initialFollowing={isFollowingUser}
              coachColor={coach.color}
            />
            <TouchableOpacity
              onPress={() => {
                haptics.tap();
                Alert.alert(
                  profile.display_name || profile.username,
                  'Choose an action',
                  [
                    {
                      text: 'Mute',
                      onPress: async () => {
                        await muteUser(targetUserId);
                        Alert.alert('Muted', 'Their posts will be hidden from your feed.');
                      },
                    },
                    {
                      text: 'Block',
                      style: 'destructive',
                      onPress: async () => {
                        await blockUser(targetUserId);
                        Alert.alert('Blocked', 'This user has been blocked.');
                        navigation.goBack();
                      },
                    },
                    { text: 'Report', onPress: () => setShowReport(true) },
                    { text: 'Cancel', style: 'cancel' },
                  ]
                );
              }}
              style={[styles.menuBtn, {
                backgroundColor: colors.glassBg,
                borderColor: colors.glassBorder,
              }]}
            >
              <MoreHorizontal size={18} color={colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Achievement Badges */}
      <ProfileBadges
        earnedBadgeIds={isOwnProfile ? null : profile.earned_badges}
      />

      {/* Stats row - glass card */}
      <FadeInView delay={200} style={{ width: '100%' }}>
        <GlassCard style={styles.statsRow} accentColor={coach.color}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>{profile.total_workouts}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Workouts</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.glassBorder }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>{counts.followers}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Followers</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.glassBorder }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>{counts.following}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Following</Text>
          </View>
          {profile.current_streak > 0 && (
            <>
              <View style={[styles.statDivider, { backgroundColor: colors.glassBorder }]} />
              <View style={styles.statItem}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Flame size={16} color={coach.color} strokeWidth={2.2} />
                  <Text style={[styles.statValue, { color: coach.color }]}>{profile.current_streak}</Text>
                </View>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Streak</Text>
              </View>
            </>
          )}
        </GlassCard>
      </FadeInView>

      {/* Posts header */}
      <Text style={[styles.postsHeader, { color: colors.textMuted }]}>
        {posts.length > 0 ? 'RECENT POSTS' : 'NO POSTS YET'}
      </Text>
    </View>
  );

  const renderPost = ({ item, index }) => (
    <FadeInView
      delay={300 + index * 60}
      style={{ paddingHorizontal: SPACING.md }}
    >
      <FeedPostCard
        post={{ ...item, profiles: profile }}
        isLiked={likedIds.has(item.id)}
        onLike={async (id) => { await likePost(id); setLikedIds(prev => new Set([...prev, id])); }}
        onUnlike={async (id) => { await unlikePost(id); setLikedIds(prev => { const n = new Set(prev); n.delete(id); return n; }); }}
        onComment={(post) => navigation.navigate('PostDetail', { post: { ...post, profiles: profile } })}
        onPostPress={(post) => navigation.navigate('PostDetail', { post: { ...post, profiles: profile } })}
      />
    </FadeInView>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={item => item.id}
        ListHeaderComponent={renderHeader}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      {/* Report Sheet */}
      <ReportSheet
        visible={showReport}
        onClose={() => setShowReport(false)}
        userId={targetUserId}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { textAlign: 'center', marginTop: 100, ...FONT.body },
  profileSection: {
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  backBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: SPACING.sm,
  },
  backText: { ...FONT.body, fontWeight: '500' },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  avatarImage: { width: 80, height: 80, borderRadius: 40 },
  displayName: { ...FONT.heading, marginBottom: 2 },
  username: { ...FONT.caption, marginBottom: 8 },
  bio: { ...FONT.body, textAlign: 'center', marginBottom: 12, maxWidth: 280 },
  followBtnContainer: { marginBottom: 16 },
  menuBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { ...FONT.stat, fontSize: 18 },
  statLabel: { ...FONT.label, fontSize: 10, marginTop: 2 },
  statDivider: { width: 1, height: 28 },
  postsHeader: {
    ...FONT.label,
    alignSelf: 'flex-start',
    marginBottom: SPACING.sm,
  },
});

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, RefreshControl, Keyboard, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, onSnapshot, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { auth, db } from '../config';
import { useTheme, BRAND } from '../constants/theme';
import { ExplorePostModal } from '../constants/ExplorePostModal';
import { AccountRow, ExploreSkeleton, ExploreTile, HighlightedText } from '../constants/SearchExploreViews';
import {
  SearchTab, canViewAccount, canViewPost, clearSearchHistoryAll, extractRealHashtags,
  extractRealPlaces, fetchExplorePostsPage, fetchHashtagPostsPage, fetchReelsPage,
  loadSearchHistory, removeSearchHistoryItem, saveSearchHistory, scorePostMatch,
  searchAccounts, toggleFollowUser,
} from '../constants/searchHelpers';

export default function ExploreScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const { c } = useTheme();
  const myUid = auth.currentUser?.uid || '';

  const [me, setMe] = useState<any>(null);
  const [queryText, setQueryText] = useState(params.q || '');
  const [submittedQuery, setSubmittedQuery] = useState(params.q || '');
  const [isFocused, setIsFocused] = useState(false);
  const [activeTab, setActiveTab] = useState<SearchTab>('top');
  const [history, setHistory] = useState<string[]>([]);

  const [explorePosts, setExplorePosts] = useState<any[]>([]);
  const [exploreCursor, setExploreCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [exploreHasMore, setExploreHasMore] = useState(true);
  const [exploreLoading, setExploreLoading] = useState(true);
  const [exploreMoreLoading, setExploreMoreLoading] = useState(false);
  const [exploreError, setExploreError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [userCache, setUserCache] = useState<Record<string, any>>({});
  const [suggestUsers, setSuggestUsers] = useState<any[]>([]);
  const [searchUsers, setSearchUsers] = useState<any[]>([]);
  const [searchReels, setSearchReels] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [drillMode, setDrillMode] = useState<{ type: 'tag' | 'place'; value: string } | null>(null);
  const [drillPosts, setDrillPosts] = useState<any[]>([]);
  const [drillCursor, setDrillCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [drillHasMore, setDrillHasMore] = useState(false);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillError, setDrillError] = useState<string | null>(null);

  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (params.q) {
      setQueryText(params.q);
      runSubmitSearch(params.q);
    }
  }, [params.q]);

  useEffect(() => {
    loadSearchHistory(myUid).then(setHistory);
    if (!myUid) return;
    return onSnapshot(doc(db, 'users', myUid), (s) => {
      if (s.exists()) setMe({ id: s.id, ...s.data() });
    });
  }, [myUid]);

  const loadInitialExplore = useCallback(async () => {
    setExploreLoading(true);
    setExploreError(null);
    try {
      const [page, users] = await Promise.all([fetchExplorePostsPage(null, 18), searchAccounts('', 30)]);
      const uMap: Record<string, any> = {};
      users.forEach((u) => { uMap[u.id] = u; });
      setUserCache((prev) => ({ ...prev, ...uMap }));
      setExplorePosts(page.items);
      setExploreCursor(page.lastDoc);
      setExploreHasMore(page.hasMore);
    } catch {
      setExploreError('Could not load Explore right now. Check your connection.');
    } finally {
      setExploreLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadInitialExplore(); }, [loadInitialExplore]);

  const loadMoreExplore = async () => {
    if (exploreMoreLoading || !exploreHasMore || !exploreCursor) return;
    setExploreMoreLoading(true);
    try {
      const page = await fetchExplorePostsPage(exploreCursor, 18);
      setExplorePosts((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        return [...prev, ...page.items.filter((x) => !seen.has(x.id))];
      });
      setExploreCursor(page.lastDoc);
      setExploreHasMore(page.hasMore);
    } catch {
    } finally {
      setExploreMoreLoading(false);
    }
  };

  useEffect(() => {
    const clean = queryText.trim();
    if (!clean || submittedQuery === clean) {
      if (!clean) setSuggestUsers([]);
      return;
    }
    const currentId = ++reqIdRef.current;
    const timer = setTimeout(async () => {
      try {
        const users = await searchAccounts(clean, 8);
        if (reqIdRef.current !== currentId) return;
        const uMap: Record<string, any> = {};
        users.forEach((u) => { uMap[u.id] = u; });
        setUserCache((prev) => ({ ...prev, ...uMap }));
        setSuggestUsers(users.filter((u) => canViewAccount(u, me, myUid)).slice(0, 6));
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [queryText, submittedQuery, me, myUid]);

  const runSubmitSearch = async (rawTerm: string) => {
    const clean = rawTerm.trim();
    if (!clean) return;
    Keyboard.dismiss();
    setIsFocused(false);
    setDrillMode(null);
    setSubmittedQuery(clean);
    setQueryText(clean);
    setSearchLoading(true);
    setSearchError(null);
    const currentId = ++reqIdRef.current;

    const updatedHist = await saveSearchHistory(myUid, clean);
    setHistory(updatedHist);

    try {
      const [users, reelsPage] = await Promise.all([searchAccounts(clean, 25), fetchReelsPage(null, 24)]);
      if (reqIdRef.current !== currentId) return;
      const uMap: Record<string, any> = {};
      users.forEach((u) => { uMap[u.id] = u; });
      setUserCache((prev) => ({ ...prev, ...uMap }));
      setSearchUsers(users);
      setSearchReels(reelsPage.items);
    } catch {
      if (reqIdRef.current === currentId) setSearchError('Search failed. Please try again.');
    } finally {
      if (reqIdRef.current === currentId) setSearchLoading(false);
    }
  };

  const openHashtagView = async (rawTag: string) => {
    const norm = rawTag.trim().toLowerCase().startsWith('#') ? rawTag.trim().toLowerCase() : `#${rawTag.trim().toLowerCase()}`;
    setDrillMode({ type: 'tag', value: norm });
    setDrillLoading(true);
    setDrillError(null);
    try {
      const page = await fetchHashtagPostsPage(norm, null, 18);
      setDrillPosts(page.items);
      setDrillCursor(page.lastDoc);
      setDrillHasMore(page.hasMore);
    } catch {
      setDrillError('Failed to load hashtag posts.');
    } finally {
      setDrillLoading(false);
    }
  };

  const loadMoreHashtag = async () => {
    if (!drillMode || drillMode.type !== 'tag' || drillLoading || !drillHasMore || !drillCursor) return;
    const page = await fetchHashtagPostsPage(drillMode.value, drillCursor, 18);
    setDrillPosts((prev) => {
      const seen = new Set(prev.map((x) => x.id));
      return [...prev, ...page.items.filter((x) => !seen.has(x.id))];
    });
    setDrillCursor(page.lastDoc);
    setDrillHasMore(page.hasMore);
  };

  const openPlaceView = (place: string) => {
    setDrillMode({ type: 'place', value: place });
    setDrillError(null);
    setDrillHasMore(false);
    const filtered = authorizedExplorePosts.filter((p) => (p.location || '').trim().toLowerCase() === place.toLowerCase());
    setDrillPosts(filtered);
  };

  const authorizedExplorePosts = useMemo(
    () => explorePosts.filter((p) => canViewPost(p, userCache[p.uid], me, myUid)),
    [explorePosts, userCache, me, myUid]
  );
  const trendingTags = useMemo(() => extractRealHashtags(authorizedExplorePosts).slice(0, 10), [authorizedExplorePosts]);
  const allPlaces = useMemo(() => extractRealPlaces(authorizedExplorePosts), [authorizedExplorePosts]);
  const suggestedCreators = useMemo(() => {
    const following: string[] = Array.isArray(me?.following) ? me.following : [];
    return Object.values(userCache)
      .filter((u) => u.id !== myUid && !following.includes(u.id) && canViewAccount(u, me, myUid))
      .slice(0, 12);
  }, [userCache, me, myUid]);

  const qLower = submittedQuery.trim().toLowerCase();
  const matchedAccounts = useMemo(() => searchUsers.filter((u) => canViewAccount(u, me, myUid)), [searchUsers, me, myUid]);
  const matchedPosts = useMemo(
    () => authorizedExplorePosts
      .map((p) => ({ post: p, score: scorePostMatch(p, qLower) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.post),
    [authorizedExplorePosts, qLower]
  );
  const matchedReels = useMemo(
    () => searchReels
      .filter((p) => canViewPost(p, userCache[p.uid], me, myUid))
      .map((p) => ({ post: p, score: scorePostMatch(p, qLower) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.post),
    [searchReels, userCache, me, myUid, qLower]
  );
  const matchedTags = useMemo(() => extractRealHashtags(authorizedExplorePosts, qLower), [authorizedExplorePosts, qLower]);
  const matchedPlaces = useMemo(() => extractRealPlaces(authorizedExplorePosts, qLower), [authorizedExplorePosts, qLower]);

  const tabs: { key: SearchTab; label: string }[] = useMemo(() => {
    const base: { key: SearchTab; label: string }[] = [
      { key: 'top', label: 'Top' },
      { key: 'accounts', label: 'Accounts' },
      { key: 'posts', label: 'Posts' },
      { key: 'reels', label: 'Reels' },
      { key: 'tags', label: 'Tags' },
    ];
    if (allPlaces.length > 0) base.push({ key: 'places', label: 'Places' });
    return base;
  }, [allPlaces.length]);

  const clearAllInput = () => {
    setQueryText('');
    setSubmittedQuery('');
    setDrillMode(null);
    setSearchError(null);
  };
    if (drillMode) {
    const safeDrillPosts = drillPosts.filter((p) => canViewPost(p, userCache[p.uid], me, myUid));
    return (
      <View style={[styles.container, { backgroundColor: c.background }]}>
        <View style={[styles.drillHeader, { borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={() => setDrillMode(null)} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={24} color={c.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontWeight: '800', fontSize: 17 }}>{drillMode.value}</Text>
            <Text style={{ color: c.muted, fontSize: 12 }}>{safeDrillPosts.length} posts</Text>
          </View>
        </View>
        {drillLoading ? (
          <ExploreSkeleton />
        ) : drillError ? (
          <View style={styles.center}>
            <Text style={{ color: c.muted, marginBottom: 10 }}>{drillError}</Text>
            <TouchableOpacity onPress={() => drillMode.type === 'tag' ? openHashtagView(drillMode.value) : openPlaceView(drillMode.value)} style={[styles.retryBtn, { backgroundColor: BRAND }]}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={safeDrillPosts}
            numColumns={3}
            keyExtractor={(i) => i.id}
            onEndReached={loadMoreHashtag}
            onEndReachedThreshold={0.4}
            ListEmptyComponent={<Text style={[styles.emptyTxt, { color: c.muted }]}>No public posts found for {drillMode.value}.</Text>}
            renderItem={({ item }) => <ExploreTile item={item} onPress={() => setSelectedPost(item)} />}
          />
        )}
        <ExplorePostModal
          post={selectedPost}
          author={selectedPost ? userCache[selectedPost.uid] : null}
          me={me}
          onClose={() => setSelectedPost(null)}
          onPressTag={openHashtagView}
          onPressPlace={openPlaceView}
        />
      </View>
    );
  }

  const showSuggestions = isFocused && !submittedQuery;

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <View style={styles.searchBarRow}>
        {(isFocused || !!submittedQuery) && (
          <TouchableOpacity onPress={() => { setIsFocused(false); clearAllInput(); Keyboard.dismiss(); }} style={{ paddingRight: 8 }}>
            <Ionicons name="arrow-back" size={23} color={c.text} />
          </TouchableOpacity>
        )}
        <View style={[styles.searchBox, { backgroundColor: c.input, borderColor: c.border }]}>
          <Ionicons name="search" size={18} color={c.muted} />
          <TextInput
            style={[styles.input, { color: c.text }]}
            placeholder="Search people, posts, reels..."
            placeholderTextColor={c.muted}
            value={queryText}
            returnKeyType="search"
            autoCapitalize="none"
            onFocus={() => setIsFocused(true)}
            onChangeText={(t) => { setQueryText(t); if (submittedQuery && t.trim() !== submittedQuery) setSubmittedQuery(''); }}
            onSubmitEditing={() => runSubmitSearch(queryText)}
          />
          {!!queryText && (
            <TouchableOpacity onPress={clearAllInput}>
              <Ionicons name="close-circle" size={18} color={c.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {showSuggestions ? (
        <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
          {!queryText.trim() && history.length > 0 && (
            <View style={{ paddingTop: 10 }}>
              <View style={styles.secHead}>
                <Text style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>Recent</Text>
                <TouchableOpacity onPress={async () => setHistory(await clearSearchHistoryAll(myUid))}>
                  <Text style={{ color: BRAND, fontWeight: '700', fontSize: 13 }}>Clear All</Text>
                </TouchableOpacity>
              </View>
              {history.map((term) => (
                <View key={term} style={styles.sugRow}>
                  <TouchableOpacity style={styles.sugLeft} onPress={() => runSubmitSearch(term)}>
                    <Ionicons name="time-outline" size={20} color={c.muted} />
                    <Text style={{ color: c.text, fontSize: 14 }}>{term}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={async () => setHistory(await removeSearchHistoryItem(myUid, term))}>
                    <Ionicons name="close" size={18} color={c.muted} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {!!queryText.trim() && (
            <View style={{ paddingTop: 6 }}>
              <TouchableOpacity style={styles.sugRow} onPress={() => runSubmitSearch(queryText)}>
                <View style={styles.sugLeft}>
                  <Ionicons name="search" size={18} color={BRAND} />
                  <Text style={{ color: BRAND, fontWeight: '700', fontSize: 14 }}>Search "{queryText.trim()}"</Text>
                </View>
              </TouchableOpacity>
              {suggestUsers.map((u) => (
                <TouchableOpacity key={u.id} style={styles.sugRow} onPress={() => { saveSearchHistory(myUid, `@${u.username}`).then(setHistory); router.navigate(`/user/${u.id}` as any); }}>
                  <View style={styles.sugLeft}>
                    {u.avatar ? <Image source={{ uri: u.avatar }} style={styles.sugAv} /> : (
                      <View style={[styles.sugAv, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}>
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{(u.username || 'U')[0].toUpperCase()}</Text>
                      </View>
                    )}
                    <View>
                      <HighlightedText text={`@${u.username}`} query={queryText} style={{ color: c.text, fontWeight: '600', fontSize: 14 }} />
                      {!!u.fullName && <HighlightedText text={u.fullName} query={queryText} style={{ color: c.muted, fontSize: 12 }} />}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
              {extractRealHashtags(authorizedExplorePosts, queryText).slice(0, 5).map((h) => (
                <TouchableOpacity key={h.tag} style={styles.sugRow} onPress={() => openHashtagView(h.tag)}>
                  <View style={styles.sugLeft}>
                    <View style={[styles.hashIcon, { borderColor: c.border }]}>
                      <Text style={{ color: c.text, fontWeight: '800' }}>#</Text>
                    </View>
                    <View>
                      <HighlightedText text={h.tag} query={queryText} style={{ color: c.text, fontWeight: '600', fontSize: 14 }} />
                      <Text style={{ color: c.muted, fontSize: 12 }}>{h.count} posts</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      ) : submittedQuery ? (
        <View style={{ flex: 1 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.tabBar, { borderBottomColor: c.border }]} contentContainerStyle={{ paddingHorizontal: 12, gap: 18 }}>
            {tabs.map((t) => {
              const active = activeTab === t.key;
              return (
                <TouchableOpacity key={t.key} onPress={() => setActiveTab(t.key)} style={[styles.tabItem, active && { borderBottomColor: BRAND, borderBottomWidth: 2 }]}>
                  <Text style={{ color: active ? c.text : c.muted, fontWeight: active ? '800' : '600', fontSize: 14 }}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {searchLoading ? (
            <View style={styles.center}><ActivityIndicator size="large" color={BRAND} /></View>
          ) : searchError ? (
            <View style={styles.center}>
              <Text style={{ color: c.muted, marginBottom: 10 }}>{searchError}</Text>
              <TouchableOpacity onPress={() => runSubmitSearch(submittedQuery)} style={[styles.retryBtn, { backgroundColor: BRAND }]}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : activeTab === 'accounts' ? (
            <FlatList
              data={matchedAccounts}
              keyExtractor={(u) => u.id}
              ListEmptyComponent={<Text style={[styles.emptyTxt, { color: c.muted }]}>No accounts found for "{submittedQuery}".</Text>}
              renderItem={({ item }) => (
                <AccountRow user={item} me={me} myUid={myUid} onPressProfile={() => router.navigate(`/user/${item.id}` as any)} onToggleFollow={() => toggleFollowUser(item, me, myUid)} />
              )}
            />
          ) : activeTab === 'posts' ? (
            <FlatList
              data={matchedPosts}
              numColumns={3}
              keyExtractor={(i) => i.id}
              ListEmptyComponent={<Text style={[styles.emptyTxt, { color: c.muted }]}>No posts found for "{submittedQuery}".</Text>}
              renderItem={({ item }) => <ExploreTile item={item} onPress={() => setSelectedPost(item)} />}
            />
          ) : activeTab === 'reels' ? (
            <FlatList
              data={matchedReels}
              numColumns={3}
              keyExtractor={(i) => i.id}
              ListEmptyComponent={<Text style={[styles.emptyTxt, { color: c.muted }]}>No reels found for "{submittedQuery}".</Text>}
              renderItem={({ item }) => <ExploreTile item={item} tall onPress={() => setSelectedPost(item)} />}
            />
          ) : activeTab === 'tags' ? (
            <FlatList
              data={matchedTags}
              keyExtractor={(i) => i.tag}
              ListEmptyComponent={<Text style={[styles.emptyTxt, { color: c.muted }]}>No hashtags found for "{submittedQuery}".</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.sugRow} onPress={() => openHashtagView(item.tag)}>
                  <View style={styles.sugLeft}>
                    <View style={[styles.hashIcon, { borderColor: c.border }]}><Text style={{ color: c.text, fontWeight: '800' }}>#</Text></View>
                    <View>
                      <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }}>{item.tag}</Text>
                      <Text style={{ color: c.muted, fontSize: 12 }}>{item.count} posts</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            />
          ) : activeTab === 'places' ? (
            <FlatList
              data={matchedPlaces}
              keyExtractor={(i) => i.place}
              ListEmptyComponent={<Text style={[styles.emptyTxt, { color: c.muted }]}>No places found for "{submittedQuery}".</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.sugRow} onPress={() => openPlaceView(item.place)}>
                  <View style={styles.sugLeft}>
                    <Ionicons name="location-outline" size={22} color={BRAND} />
                    <View>
                      <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }}>{item.place}</Text>
                      <Text style={{ color: c.muted, fontSize: 12 }}>{item.count} posts</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            />
          ) : (
            <FlatList
              data={matchedPosts}
              numColumns={3}
              keyExtractor={(i) => i.id}
              ListHeaderComponent={
                <View>
                  {matchedAccounts.slice(0, 4).map((u) => (
                    <AccountRow key={u.id} user={u} me={me} myUid={myUid} onPressProfile={() => router.navigate(`/user/${u.id}` as any)} onToggleFollow={() => toggleFollowUser(u, me, myUid)} />
                  ))}
                  {matchedTags.slice(0, 2).map((t) => (
                    <TouchableOpacity key={t.tag} style={styles.sugRow} onPress={() => openHashtagView(t.tag)}>
                      <View style={styles.sugLeft}>
                        <View style={[styles.hashIcon, { borderColor: c.border }]}><Text style={{ color: c.text, fontWeight: '800' }}>#</Text></View>
                        <Text style={{ color: c.text, fontWeight: '700' }}>{t.tag} ({t.count})</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              }
              ListEmptyComponent={matchedAccounts.length === 0 && matchedTags.length === 0 ? <Text style={[styles.emptyTxt, { color: c.muted }]}>No results found for "{submittedQuery}".</Text> : null}
              renderItem={({ item }) => <ExploreTile item={item} onPress={() => setSelectedPost(item)} />}
            />
          )}
        </View>
      ) : exploreLoading ? (
        <ExploreSkeleton />
      ) : exploreError ? (
        <View style={styles.center}>
          <Text style={{ color: c.muted, marginBottom: 10 }}>{exploreError}</Text>
          <TouchableOpacity onPress={loadInitialExplore} style={[styles.retryBtn, { backgroundColor: BRAND }]}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={authorizedExplorePosts}
          numColumns={3}
          keyExtractor={(i) => i.id}
          onEndReached={loadMoreExplore}
          onEndReachedThreshold={0.4}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadInitialExplore(); }} tintColor={BRAND} />}
          ListHeaderComponent={
            <View style={{ paddingBottom: 8 }}>
              {trendingTags.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 8, paddingVertical: 8 }}>
                  {trendingTags.map((t) => (
                    <TouchableOpacity key={t.tag} onPress={() => openHashtagView(t.tag)} style={[styles.chip, { backgroundColor: c.input, borderColor: c.border }]}>
                      <Text style={{ color: c.text, fontWeight: '700', fontSize: 12 }}>{t.tag}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              {suggestedCreators.length > 0 && (
                <View style={{ marginBottom: 6 }}>
                  <Text style={[styles.subTitle, { color: c.muted }]}>Suggested for you</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 10 }}>
                    {suggestedCreators.map((u) => (
                      <TouchableOpacity key={u.id} style={[styles.creatorCard, { backgroundColor: c.card, borderColor: c.border }]} onPress={() => router.navigate(`/user/${u.id}` as any)}>
                        {u.avatar ? <Image source={{ uri: u.avatar }} style={styles.creatorAv} /> : (
                          <View style={[styles.creatorAv, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}>
                            <Text style={{ color: '#fff', fontWeight: '700' }}>{(u.username || 'U')[0].toUpperCase()}</Text>
                          </View>
                        )}
                        <Text style={{ color: c.text, fontWeight: '700', fontSize: 12 }} numberOfLines={1}>@{u.username}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          }
          ListFooterComponent={exploreMoreLoading ? <ActivityIndicator style={{ marginVertical: 14 }} color={BRAND} /> : null}
          ListEmptyComponent={<Text style={[styles.emptyTxt, { color: c.muted }]}>No public posts to explore yet.</Text>}
          renderItem={({ item }) => <ExploreTile item={item} onPress={() => setSelectedPost(item)} />}
        />
      )}

      <ExplorePostModal
        post={selectedPost}
        author={selectedPost ? userCache[selectedPost.uid] : null}
        me={me}
        onClose={() => setSelectedPost(null)}
        onPressTag={openHashtagView}
        onPressPlace={openPlaceView}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 46 },
  searchBarRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, gap: 8, height: 42 },
  input: { flex: 1, fontSize: 14, paddingVertical: 0 },
  tabBar: { maxHeight: 42, borderBottomWidth: 1 },
  tabItem: { paddingVertical: 10, paddingHorizontal: 4 },
  secHead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 6 },
  sugRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10 },
  sugLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sugAv: { width: 38, height: 38, borderRadius: 19 },
  hashIcon: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  subTitle: { fontSize: 12, fontWeight: '700', paddingHorizontal: 14, marginBottom: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  creatorCard: { width: 92, padding: 10, borderRadius: 12, borderWidth: 1, alignItems: 'center', gap: 6 },
  creatorAv: { width: 44, height: 44, borderRadius: 22 },
  drillHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 10, borderBottomWidth: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  retryBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8 },
  emptyTxt: { textAlign: 'center', marginTop: 40, fontSize: 14 },
});
                                                   

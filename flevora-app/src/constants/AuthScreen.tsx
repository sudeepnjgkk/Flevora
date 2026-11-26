import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config';
import { useTheme, NEON } from './theme';
import { FlevoraLogo } from './FlevoraLogo';
import { GradientButton } from './GradientButton';

const errTxt = (code: string) => {
  if (code.includes('invalid-email')) return 'Please enter a valid email address.';
  if (code.includes('user-not-found') || code.includes('invalid-credential')) return 'Invalid email or password.';
  if (code.includes('wrong-password')) return 'Incorrect password.';
  if (code.includes('email-already-in-use')) return 'This email is already registered.';
  if (code.includes('weak-password')) return 'Password must be at least 6 characters.';
  return 'Something went wrong. Please try again.';
};

export function AuthScreen({ onGoogle, googleDisabled }: { onGoogle: () => void; googleDisabled?: boolean }) {
  const { c, isDark } = useTheme();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const handleAuth = async () => {
    setErr('');
    if (!email.trim() || !password) return setErr('Please enter email and password.');
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        const uname = (username.trim() || email.split('@')[0]).toLowerCase().replace(/[^a-z0-9_]/g, '');
        const res = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await setDoc(doc(db, 'users', res.user.uid), {
          uid: res.user.uid, email: email.trim(), username: uname, fullName: uname, bio: '', website: '', avatar: '',
          role: 'user', status: 'active', isPrivate: false, isOnline: true, lastSeen: serverTimestamp(),
          followers: [], following: [], savedPosts: [], blockedUsers: [], createdAt: serverTimestamp(),
        });
        sendEmailVerification(res.user).catch(() => {});
      }
    } catch (e: any) {
      setErr(errTxt(e?.code || ''));
    } finally {
      setLoading(false);
    }
  };

  const forgot = async () => {
    if (!email.trim()) return Alert.alert('Reset Password', 'Enter your email first.');
    try {
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert('Email Sent', 'Password reset link sent to your email.');
    } catch (e: any) {
      Alert.alert('Error', errTxt(e?.code || ''));
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <View style={[s.glowOrb, { backgroundColor: isDark ? NEON.purple : NEON.pink }]} />
        <View style={s.logoBox}>
          <FlevoraLogo size={82} />
          <Text style={[s.brand, { color: c.text }]}>Flevora</Text>
          <Text style={{ color: c.muted, fontSize: 13, marginTop: 4 }}>{isLogin ? 'Welcome back to your world' : 'Create your Neon account'}</Text>
        </View>

        <View style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
          {!isLogin && (
            <View style={[s.inpWrap, { backgroundColor: c.input, borderColor: c.border }]}>
              <Ionicons name="at" size={18} color={NEON.purple} />
              <TextInput value={username} onChangeText={setUsername} placeholder="Username" placeholderTextColor={c.muted} autoCapitalize="none" style={[s.inp, { color: c.text }]} />
            </View>
          )}
          <View style={[s.inpWrap, { backgroundColor: c.input, borderColor: c.border }]}>
            <Ionicons name="mail-outline" size={18} color={NEON.purple} />
            <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={c.muted} keyboardType="email-address" autoCapitalize="none" style={[s.inp, { color: c.text }]} />
          </View>
          <View style={[s.inpWrap, { backgroundColor: c.input, borderColor: c.border }]}>
            <Ionicons name="lock-closed-outline" size={18} color={NEON.pink} />
            <TextInput value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={c.muted} secureTextEntry={!showPass} style={[s.inp, { color: c.text }]} />
            <TouchableOpacity onPress={() => setShowPass((v) => !v)}><Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={c.muted} /></TouchableOpacity>
          </View>

          {!!err && <Text style={s.err}>{err}</Text>}
          {isLogin && <TouchableOpacity onPress={forgot} style={{ alignSelf: 'flex-end', marginBottom: 12 }}><Text style={{ color: NEON.purple, fontWeight: '700', fontSize: 13 }}>Forgot Password?</Text></TouchableOpacity>}

          <GradientButton title={isLogin ? 'Sign In' : 'Create Account'} onPress={handleAuth} loading={loading} />

          <TouchableOpacity disabled={googleDisabled} onPress={onGoogle} style={[s.gBtn, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Ionicons name="logo-google" size={18} color={NEON.orange} />
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }}>Continue with Google</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => { setIsLogin((v) => !v); setErr(''); }} style={{ marginTop: 22, alignItems: 'center' }}>
          <Text style={{ color: c.muted, fontSize: 14 }}>
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <Text style={{ color: NEON.pink, fontWeight: '800' }}>{isLogin ? 'Sign Up' : 'Sign In'}</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: 'center', padding: 22 },
  glowOrb: { position: 'absolute', top: -100, right: -80, width: 260, height: 260, borderRadius: 130, opacity: 0.14 },
  logoBox: { alignItems: 'center', marginBottom: 24 },
  brand: { fontSize: 30, fontWeight: '900', marginTop: 12, letterSpacing: -0.5 },
  card: { borderRadius: 24, borderWidth: 1, padding: 18, gap: 12 },
  inpWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, height: 50 },
  inp: { flex: 1, fontSize: 15 },
  err: { color: '#EF4444', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  gBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, height: 48, borderRadius: 14, borderWidth: 1, marginTop: 4 },
});

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const BRAND = '#8B5CF6';

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; msg: string }> {
  state = { hasError: false, msg: '' };

  static getDerivedStateFromError(err: any) {
    return { hasError: true, msg: err?.message || 'Unknown error' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.box}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.sub}>{this.state.msg}</Text>
          <TouchableOpacity style={styles.btn} onPress={() => this.setState({ hasError: false, msg: '' })}>
            <Text style={styles.btnTxt}>Reload App</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  box: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#FFFFFF' },
  title: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 8 },
  sub: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginBottom: 20 },
  btn: { backgroundColor: BRAND, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12 },
  btnTxt: { color: '#FFFFFF', fontWeight: '700' },
});

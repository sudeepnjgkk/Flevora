import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Lang = 'English' | 'Hindi' | 'Hinglish';

const dict = {
  English: {
    home: 'Home', explore: 'Explore', create: 'Create', reels: 'Reels', profile: 'Profile',
    settings: 'Settings & Privacy', editProfile: 'Edit Profile', privateAcc: 'Private Account',
    activity: 'Show Activity Status', darkMode: 'Dark Mode', likeNotif: 'Like Notifications',
    commentNotif: 'Comment Notifications', language: 'Language', changePass: 'Change Password',
    downloadData: 'Download My Data (JSON)', privacy: 'Privacy Policy & Terms',
    guidelines: 'Community Guidelines', logout: 'Log Out', deactivate: 'Deactivate Account',
    deleteAcc: 'Delete Account Permanently', newPost: 'New Post', publish: 'Publish Post',
    messages: 'Messages', notifications: 'Notifications', noPosts: 'No posts yet.',
    signIn: 'Sign In', createAcc: 'Create Account',
    selectMedia: 'Select Media', next: 'Next', sharePost: 'Share', editPost: 'Edit Post',
    captionPlaceholder: 'Write a caption... Use @mentions and #hashtags',
    tagPeople: 'Tag People', addLocation: 'Add Location', collaborators: 'Invite Collaborators',
    audience: 'Audience', advancedSettings: 'Advanced Settings',
    saveDraft: 'Save Draft', discardDraft: 'Discard',
  },
  Hindi: {
    home: 'होम', explore: 'खोजें', create: 'बनाएं', reels: 'रील्स', profile: 'प्रोफ़ाइल',
    settings: 'सेटिंग्स और प्राइवेसी', editProfile: 'प्रोफ़ाइल बदलें', privateAcc: 'प्राइवेट अकाउंट',
    activity: 'एक्टिविटी स्टेटस दिखाएं', darkMode: 'डार्क मोड', likeNotif: 'लाइक नोटिफिकेशन',
    commentNotif: 'कमेंट नोटिफिकेशन', language: 'भाषा', changePass: 'पासवर्ड बदलें',
    downloadData: 'मेरा डेटा डाउनलोड करें', privacy: 'प्राइवेसी पॉलिसी और नियम',
    guidelines: 'कम्युनिटी गाइडलाइंस', logout: 'लॉग आउट', deactivate: 'अकाउंट बंद करें',
    deleteAcc: 'अकाउंट हमेशा के लिए हटाएं', newPost: 'नई पोस्ट', publish: 'पोस्ट शेयर करें',
    messages: 'मैसेज', notifications: 'नोटिफिकेशन', noPosts: 'अभी कोई पोस्ट नहीं है।',
    signIn: 'साइन इन', createAcc: 'नया अकाउंट बनाएं',
    selectMedia: 'मीडिया चुनें', next: 'आगे', sharePost: 'शेयर करें', editPost: 'पोस्ट एडिट करें',
    captionPlaceholder: 'कैप्शन लिखें... @mentions और #hashtags का उपयोग करें',
    tagPeople: 'लोगों को टैग करें', addLocation: 'लोकेशन जोड़ें', collaborators: 'कोलैबोरेटर जोड़ें',
    audience: 'ऑडियंस', advancedSettings: 'एडवांस्ड सेटिंग्स',
    saveDraft: 'ड्राफ्ट सेव करें', discardDraft: 'हटाएं',
  },
  Hinglish: {
    home: 'Home', explore: 'Explore', create: 'Post Banao', reels: 'Reels', profile: 'Profile',
    settings: 'Settings aur Privacy', editProfile: 'Profile Edit Karo', privateAcc: 'Private Account',
    activity: 'Online Status Dikhao', darkMode: 'Dark Mode', likeNotif: 'Like Alerts',
    commentNotif: 'Comment Alerts', language: 'Bhasha (Language)', changePass: 'Password Badlo',
    downloadData: 'Apna Data Download Karo', privacy: 'Privacy Policy aur Rules',
    guidelines: 'Community Guidelines', logout: 'Log Out', deactivate: 'Account Deactivate Karo',
    deleteAcc: 'Account Hamesha Ke Liye Delete', newPost: 'Nayi Post', publish: 'Post Publish Karo',
    messages: 'Messages', notifications: 'Notifications', noPosts: 'Abhi koi post nahin hai.',
    signIn: 'Sign In Karo', createAcc: 'Naya Account Banao',
    selectMedia: 'Media Chuno', next: 'Next', sharePost: 'Share Karo', editPost: 'Post Edit Karo',
    captionPlaceholder: 'Caption likho... @mentions aur #hashtags use karo',
    tagPeople: 'Logon Ko Tag Karo', addLocation: 'Location Add Karo', collaborators: 'Collaborators Invite Karo',
    audience: 'Audience', advancedSettings: 'Advanced Settings',
    saveDraft: 'Draft Save Karo', discardDraft: 'Discard Karo',
  },
};

type LangCtx = { lang: Lang; setLang: (l: Lang) => void; t: typeof dict.English };

const LangContext = createContext<LangCtx>({ lang: 'English', setLang: () => {}, t: dict.English });

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('English');

  useEffect(() => {
    AsyncStorage.getItem('flevora_lang').then((v) => {
      if (v === 'English' || v === 'Hindi' || v === 'Hinglish') setLangState(v);
    });
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem('flevora_lang', l);
  };

  return React.createElement(LangContext.Provider, { value: { lang, setLang, t: dict[lang] } }, children);
}

export const useLang = () => useContext(LangContext);

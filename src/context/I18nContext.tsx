/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { db } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

type Locale = "en" | "ar";

type Dictionary = Record<string, Record<Locale, string>>;

const messages: Dictionary = {
  app_title: { en: "Ishara Web App", ar: "منصة إشارة" },
  sign_up: { en: "Sign Up", ar: "إنشاء حساب" },
  login: { en: "Login", ar: "تسجيل الدخول" },
  logout: { en: "Logout", ar: "تسجيل الخروج" },
  profile: { en: "Profile", ar: "الملف الشخصي" },
  dashboard: { en: "Dashboard", ar: "لوحة التحكم" },
  book_session: { en: "Book Session", ar: "حجز جلسة" },
  requests: { en: "Requests", ar: "الطلبات" },
  my_profile: { en: "My Profile", ar: "ملفي الشخصي" },
  name: { en: "Name", ar: "الاسم" },
  language: { en: "Language", ar: "اللغة" },
  save: { en: "Save", ar: "حفظ" },
  email: { en: "Email", ar: "البريد الإلكتروني" },
  password: { en: "Password", ar: "كلمة المرور" },
  create_account: { en: "Create Account", ar: "إنشاء الحساب" },
  role_deaf_mute: { en: "Deaf/Mute", ar: "أصم/أبكم" },
  role_interpreter: { en: "Interpreter", ar: "مترجم" },
  deaf_dashboard_title: { en: "Deaf/Mute Dashboard", ar: "لوحة مستخدم أصم/أبكم" },
  deaf_dashboard_desc: { en: "Browse interpreters and book sessions.", ar: "استعرض المترجمين واحجز الجلسات." },
  interpreter_dashboard_title: { en: "Interpreter Dashboard", ar: "لوحة المترجم" },
  interpreter_dashboard_desc: { en: "Manage availability and incoming requests.", ar: "إدارة التوفر والطلبات الواردة." },
  book_title: { en: "Book a Session", ar: "حجز جلسة" },
  requests_title: { en: "Incoming Requests", ar: "الطلبات الواردة" },
  availability: { en: "Availability", ar: "التوفر" },
  add_slot: { en: "Add Slot", ar: "إضافة فترة" },
  start_time: { en: "Start Time", ar: "وقت البدء" },
  end_time: { en: "End Time", ar: "وقت الانتهاء" },
  delete: { en: "Delete", ar: "حذف" },
  request_session: { en: "Request Session", ar: "طلب جلسة" },
  accept: { en: "Accept", ar: "قبول" },
  reject: { en: "Reject", ar: "رفض" },
  interpreters: { en: "Interpreters", ar: "المترجمون" },
  available_slots: { en: "Available Slots", ar: "الفترات المتاحة" },
  weekly_availability: { en: "Weekly Availability", ar: "التوفر الأسبوعي" },
  always_available: { en: "Available 24/7", ar: "متاح 24/7" },
  morning_shift: { en: "Morning (6 AM - 2 PM)", ar: "صباحي (6 ص - 2 م)" },
  evening_shift: { en: "Evening (2 PM - 10 PM)", ar: "مسائي (2 م - 10 م)" },
  sunday: { en: "Sunday", ar: "الأحد" },
  monday: { en: "Monday", ar: "الاثنين" },
  tuesday: { en: "Tuesday", ar: "الثلاثاء" },
  wednesday: { en: "Wednesday", ar: "الأربعاء" },
  thursday: { en: "Thursday", ar: "الخميس" },
  friday: { en: "Friday", ar: "الجمعة" },
  saturday: { en: "Saturday", ar: "السبت" },
  save_changes: { en: "Save Changes", ar: "حفظ التغييرات" },
  choose_day_shift: { en: "Choose Day and Shift", ar: "اختر اليوم والفترة" },
  day: { en: "Day", ar: "اليوم" },
  shift: { en: "Shift", ar: "الفترة" },
  schedule_updated: { en: "Schedule updated successfully", ar: "تم تحديث الجدول بنجاح" },
  booking_mode: { en: "Booking Mode", ar: "وضع الحجز" },
  immediate: { en: "Immediate", ar: "فوري" },
  scheduled: { en: "Scheduled", ar: "مجدول" },
  select_date: { en: "Select Date", ar: "اختر التاريخ" },
  select_time: { en: "Select Time", ar: "اختر الوقت" },
  find_interpreters: { en: "Find Interpreters", ar: "اعرض المترجمين" },
  available_interpreters: { en: "Available Interpreters", ar: "المترجمون المتاحون" },
  reserve: { en: "Reserve", ar: "احجز" },
  my_sessions: { en: "My Sessions", ar: "جلساتي" },
  status_requested: { en: "Requested", ar: "قيد الطلب" },
  status_confirmed: { en: "Confirmed", ar: "مؤكد" },
  status_cancelled: { en: "Cancelled", ar: "ملغي" },
  join: { en: "Join", ar: "انضم" },
  session_time: { en: "Time", ar: "الوقت" },
  session_with: { en: "With", ar: "مع" },
  session_status: { en: "Status", ar: "الحالة" },
  call_room_title: { en: "Video Call", ar: "مكالمة فيديو" },
  call_room_desc: { en: "You are in session {sessionId}", ar: "أنت في الجلسة {sessionId}" },
  joining_call: { en: "Joining call...", ar: "جاري الانضمام للمكالمة..." },
  waiting_participant: { en: "Waiting for other participant...", ar: "في انتظار المشارك الآخر..." },
  connected: { en: "Connected", ar: "متصل" },
  connecting: { en: "Connecting...", ar: "جاري الاتصال..." },
  mic_on: { en: "Mic: On", ar: "الميكروفون: تشغيل" },
  mic_off: { en: "Mic: Off", ar: "الميكروفون: إيقاف" },
  camera_on: { en: "Camera: On", ar: "الكاميرا: تشغيل" },
  camera_off: { en: "Camera: Off", ar: "الكاميرا: إيقاف" },
  screen_sharing: { en: "Screen: Sharing", ar: "الشاشة: مشاركة" },
  screen_not_sharing: { en: "Screen: Not Sharing", ar: "الشاشة: غير مشاركة" },
  join_call: { en: "Join Call", ar: "انضم للمكالمة" },
  interpreter_sessions: { en: "My Sessions", ar: "جلساتي" },
};

interface I18nValue {
  locale: Locale;
  direction: "ltr" | "rtl";
  t: (key: keyof typeof messages) => string;
  setLocale: (loc: Locale) => Promise<void> | void;
}

const I18nContext = createContext<I18nValue>({
  locale: "en",
  direction: "ltr",
  t: (k) => {
    const message = messages[k];
    return message ? message.en : k;
  },
  setLocale: () => {}
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const snap = await getDoc(doc(db, "users", user.uid));
      const lang = (snap.exists() ? (snap.data() as { language?: string }).language : undefined) as Locale | undefined;
      if (lang === "ar" || lang === "en") setLocaleState(lang);
    };
    load();
  }, [user]);

  const setLocale = async (loc: Locale) => {
    setLocaleState(loc);
    if (user) {
      await updateDoc(doc(db, "users", user.uid), { language: loc });
    }
  };

  const direction = locale === "ar" ? "rtl" : "ltr";
  const value = useMemo<I18nValue>(() => ({
    locale,
    direction,
    t: (key) => {
      const message = messages[key];
      if (!message) {
        console.warn(`Translation key "${key}" not found`);
        return key; // Return the key itself as fallback
      }
      return message[locale] || message.en || key;
    },
    setLocale
  }), [locale]);

  useEffect(() => {
    document.documentElement.dir = direction;
  }, [direction]);

  return (
    <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);



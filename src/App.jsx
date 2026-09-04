import React, { useState, useEffect, useMemo, useRef, Component } from 'react';
import {
  MapPin,
  Calendar,
  Clock,
  Plus,
  Search,
  Utensils,
  Coffee,
  ShoppingBag,
  Camera,
  List,
  Map as MapIcon,
  Store,
  Trash2,
  Star,
  X,
  ChevronRight,
  ChevronDown,
  Navigation,
  ExternalLink,
  Edit2,
  AlertCircle,
  Key,
  Filter,
  Check,
  Building2,
  Compass,
  RefreshCw,
  Download,
  Upload,
  Bookmark,
  Plane,
  Sparkles
} from 'lucide-react';

// ==========================================
// 安全なID生成（crypto.randomUUIDのポリフィル）
// ==========================================
function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch (e) {
      // フォールバックへ
    }
  }
  return 'id-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);
}

// ==========================================
// カテゴリー定義
// ==========================================
const CATEGORIES = {
  food: { label: 'グルメ・飲食店', icon: Utensils, emoji: '🍽️', color: '#f97316', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  cafe: { label: 'カフェ・喫茶', icon: Coffee, emoji: '☕', color: '#8b5cf6', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  shopping: { label: 'ショッピング', icon: ShoppingBag, emoji: '🛍️', color: '#ec4899', bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
  sightseeing: { label: '観光・散策・公園', icon: Camera, emoji: '📸', color: '#0ea5e9', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  hotel: { label: 'ホテル・宿泊', icon: Building2, emoji: '🏨', color: '#059669', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  other: { label: 'その他施設・駅', icon: MapPin, emoji: '📍', color: '#64748b', bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' }
};

// カテゴリーの絵文字＋色から、地図ピン用のSVGアイコン（data URI）を作る
// Googleマップのスポットアイコンのように、吹き出し（ピンの尻尾）を持たない
// 丸いバッジの中に絵文字を乗せるだけのシンプルな形にする
function buildEmojiMarkerIcon(emoji, color, faded = false) {
  const opacity = faded ? 0.6 : 1;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
      <circle cx="15" cy="15" r="13" fill="${color}" stroke="#ffffff" stroke-width="2" opacity="${opacity}"/>
      <text x="15" y="20" font-size="15" text-anchor="middle">${emoji}</text>
    </svg>
  `.trim();

  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new window.google.maps.Size(30, 30),
    anchor: new window.google.maps.Point(15, 15)
  };
}

// Google Places types からカテゴリー推定
function detectCategoryFromTypes(types = []) {
  if (!types || !Array.isArray(types)) return 'food';
  if (types.some(t => ['restaurant', 'food', 'bar', 'bakery', 'meal_takeaway'].includes(t))) return 'food';
  if (types.some(t => ['cafe', 'coffee_shop'].includes(t))) return 'cafe';
  if (types.some(t => ['store', 'shopping_mall', 'clothing_store', 'book_store', 'supermarket'].includes(t))) return 'shopping';
  if (types.some(t => ['tourist_attraction', 'park', 'museum', 'amusement_park', 'point_of_interest'].includes(t))) return 'sightseeing';
  if (types.some(t => ['lodging', 'hotel'].includes(t))) return 'hotel';
  return 'other';
}

// ==========================================
// 日付ユーティリティ（JST/ローカルタイムゾーン安全）
// ==========================================
function parseLocalDate(dateStr) {
  if (!dateStr) return new Date();
  const parts = dateStr.split('-');
  if (parts.length !== 3) return new Date(dateStr);
  const [y, m, d] = parts.map(Number);
  return new Date(y, m - 1, d, 0, 0, 0);
}

function getTodayDateString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateWithWeekday(dateStr) {
  if (!dateStr) return '';
  const d = parseLocalDate(dateStr);
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const w = weekdays[d.getDay()];
  return `${y}/${m}/${day} (${w})`;
}

function getRelativeDays(dateStr) {
  if (!dateStr) return '';
  const target = parseLocalDate(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffTime = today.getTime() - target.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '今日';
  if (diffDays === 1) return '昨日';
  if (diffDays > 0) return `${diffDays}日前`;
  return `${Math.abs(diffDays)}日後`;
}

// ==========================================
// 距離計算ユーティリティ（近くの保存済みスポット用）
// ==========================================
function calculateDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000; // 地球の半径(m)
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

// ==========================================
// 画像圧縮ユーティリティ（訪問記録の写真）
// 端末のブラウザ内(localStorage)に保存するため、
// 長辺を縮小しJPEGで再圧縮して容量を抑える
// ==========================================
function compressImageFile(file, maxDimension = 900, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round(height * (maxDimension / width));
            width = maxDimension;
          } else {
            width = Math.round(width * (maxDimension / height));
            height = maxDimension;
          }
        }
        try {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ==========================================
// 初期サンプルデータ（正規化モデル）
// ==========================================
const INITIAL_PLACES = [
  {
    id: 'place-taimeiken',
    googlePlaceId: 'ChIJ-TG2D2SLGGARw3b-240y8k0',
    name: 'たいめいけん',
    address: '東京都中央区日本橋室町1丁目2-6',
    lat: 35.6814,
    lng: 139.7738,
    googleMapsUrl: 'https://maps.google.com/?cid=1234567890',
    category: 'food',
    country: '日本',
    administrativeArea: '東京都',
    locality: '中央区'
  },
  {
    id: 'place-yogen-cafe',
    googlePlaceId: 'ChIJ_yX2e1mMGGARWzO9k4cR8p4',
    name: '珈琲専門店 預言カフェ 高田馬場',
    address: '東京都新宿区高田馬場4丁目14-8',
    lat: 35.7135,
    lng: 139.7042,
    googleMapsUrl: 'https://maps.google.com/?cid=2345678901',
    category: 'cafe',
    country: '日本',
    administrativeArea: '東京都',
    locality: '新宿区'
  },
  {
    id: 'place-shilin',
    googlePlaceId: 'ChIJy3v84WSpQjQREm6z7q9h3K0',
    name: '士林夜市 (Shilin Night Market)',
    address: '111 台湾 台北市士林區基河路101號',
    lat: 25.0880,
    lng: 121.5244,
    googleMapsUrl: 'https://maps.google.com/?cid=3456789012',
    category: 'food',
    country: '台湾',
    administrativeArea: '台北市',
    locality: '士林區'
  },
  {
    id: 'place-dintaifung',
    googlePlaceId: 'ChIJV4q7hXupQjQRQO2YfK4k0E4',
    name: '鼎泰豐 信義本店',
    address: '106 台湾 台北市大安區信義路二段194號',
    lat: 25.0336,
    lng: 121.5298,
    googleMapsUrl: 'https://maps.google.com/?cid=4567890123',
    category: 'food',
    country: '台湾',
    administrativeArea: '台北市',
    locality: '大安區'
  },
  {
    id: 'place-kurumu',
    googlePlaceId: 'ChIJs8_831aMGGARx_e8s1aE2X0',
    name: 'くるむ サンパ店 (新大久保)',
    address: '東京都新宿区大久保2丁目32-2',
    lat: 35.7018,
    lng: 139.7025,
    googleMapsUrl: 'https://maps.google.com/?cid=5678901234',
    category: 'food',
    country: '日本',
    administrativeArea: '東京都',
    locality: '新宿区'
  },
  {
    id: 'place-miyashita',
    googlePlaceId: 'ChIJyY7uMVOOGGARuE5E5q2y9c0',
    name: 'MIYASHITA PARK (渋谷)',
    address: '東京都渋谷区神宮前6丁目20-10',
    lat: 35.6622,
    lng: 139.7018,
    googleMapsUrl: 'https://maps.google.com/?cid=6789012345',
    category: 'sightseeing',
    country: '日本',
    administrativeArea: '東京都',
    locality: '渋谷区'
  }
];

const INITIAL_VISITS = [
  {
    id: 'visit-1',
    placeId: 'place-taimeiken',
    date: '2026-08-28',
    rating: 5,
    note: '名物オムライス。ふわとろで卵とケチャップライスの相性が抜群でした。'
  },
  {
    id: 'visit-2',
    placeId: 'place-yogen-cafe',
    date: '2026-08-28',
    rating: 4,
    note: '落ち着いた静かな空間で作業がとても捗りました。ブレンドコーヒーも香り高い。'
  },
  {
    id: 'visit-3',
    placeId: 'place-shilin',
    date: '2026-08-27',
    rating: 5,
    note: '熱気あふれる屋台で大鶏排とフレッシュなマンゴージュースを満喫。'
  },
  {
    id: 'visit-4',
    placeId: 'place-dintaifung',
    date: '2026-08-24',
    rating: 5,
    note: '台湾到着日に訪問。肉汁あふれる小籠包と酸辣湯の組み合わせが最高。'
  },
  {
    id: 'visit-5',
    placeId: 'place-dintaifung',
    date: '2026-08-26',
    rating: 5,
    note: '美味しすぎて滞在中2度目の再訪！トリュフ入り小籠包も注文。'
  },
  {
    id: 'visit-6',
    placeId: 'place-kurumu',
    date: '2026-08-22',
    rating: 4,
    note: '新鮮な野菜が山盛りで食べられるヘルシーなサムギョプサル。'
  },
  {
    id: 'visit-7',
    placeId: 'place-miyashita',
    date: '2026-08-19',
    rating: 4,
    note: '屋上芝生ひろばで風に吹かれながら休憩。見晴らしが良い。'
  }
];

// ==========================================
// 初期サンプルデータ（行きたい場所リスト）
// ==========================================
const INITIAL_WISHLIST = [
  {
    id: 'wish-fuunji',
    googlePlaceId: 'wish-fuunji-seed',
    name: '風雲児 (新宿つけ麺)',
    address: '東京都新宿区西新宿1丁目6-2',
    lat: 35.6909,
    lng: 139.6997,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=%E9%A2%A8%E9%9B%B2%E5%85%90+%E6%96%B0%E5%AE%BF',
    category: 'food',
    country: '日本',
    administrativeArea: '東京都',
    locality: '新宿区',
    memo: '行列必至のつけ麺の名店。開店直後を狙いたい。',
    addedAt: '2026-08-30'
  },
  {
    id: 'wish-jiufen',
    googlePlaceId: 'wish-jiufen-seed',
    name: '九份老街',
    address: '台湾新北市瑞芳区九份',
    lat: 25.1097,
    lng: 121.8446,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=%E4%B9%9D%E4%BB%BD%E8%80%81%E8%A1%97',
    category: 'sightseeing',
    country: '台湾',
    administrativeArea: '新北市',
    locality: '瑞芳区',
    memo: '次に台湾に行ったら夕方〜夜の景色を見に行きたい。',
    addedAt: '2026-08-30'
  }
];

// ストレージキー
const STORAGE_PLACES_KEY = 'odekake_places_v3';
const STORAGE_VISITS_KEY = 'odekake_visits_v3';
const STORAGE_WISHLIST_KEY = 'odekake_wishlist_v3';
const STORAGE_API_KEY = 'odekake_gmaps_api_key_v3';

// ==========================================
// エラーバウンダリ（クラッシュ完全防止）
// ==========================================
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center bg-white min-h-screen flex flex-col items-center justify-center font-sans">
          <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
          <h2 className="text-base font-bold text-neutral-800 mb-1">エラーが発生しました</h2>
          <p className="text-xs text-neutral-500 mb-4 max-w-xs">
            {this.state.error?.message || '予期せぬエラーが発生しました。'}
          </p>
          <button
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            className="px-4 py-2 bg-sky-500 text-white text-xs font-bold rounded-xl shadow-sm"
          >
            初期化してリロード
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ==========================================
// メインアプリケーション
// ==========================================
export default function App() {
  return (
    <ErrorBoundary>
      <OdekakeLogMain />
    </ErrorBoundary>
  );
}

function OdekakeLogMain() {
  const [activeTab, setActiveTab] = useState('logs'); // 'logs' (記録) | 'places' (場所) | 'map' (マップ)

  // APIキーの取得（ブラウザ安全な参照のみ）
  const [apiKey, setApiKey] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.__GOOGLE_MAPS_API_KEY__) {
        return window.__GOOGLE_MAPS_API_KEY__;
      }
      return localStorage.getItem(STORAGE_API_KEY) || '';
    } catch (e) {
      return '';
    }
  });

  const [isMapsLoaded, setIsMapsLoaded] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');

  // データステート
  const [places, setPlaces] = useState(INITIAL_PLACES);
  const [visits, setVisits] = useState(INITIAL_VISITS);
  const [wishlist, setWishlist] = useState(INITIAL_WISHLIST);

  // フィルター・検索
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // 「場所」タブ内の切り替え（訪問済み／行きたい）と「記録」タブの並び替え軸
  const [placesSubView, setPlacesSubView] = useState('visited'); // 'visited' | 'wishlist'
  const [logsGroupBy, setLogsGroupBy] = useState('month'); // 'month' | 'trip'

  // 近くの保存済み（行きたい）スポット
  const [userLocation, setUserLocation] = useState(null); // { lat, lng }
  const [isLocatingNearby, setIsLocatingNearby] = useState(false);
  const [nearbyError, setNearbyError] = useState('');
  const [nearbyRadiusFilter, setNearbyRadiusFilter] = useState(3000); // メートル、nullで絞り込みなし
  const [isNearbyPanelOpen, setIsNearbyPanelOpen] = useState(false);

  // モーダル・ダイアログ
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState(null);
  const [editingPlace, setEditingPlace] = useState(null);
  const [convertingWishlistId, setConvertingWishlistId] = useState(null);
  const [isWishlistModalOpen, setIsWishlistModalOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [selectedPlaceDetail, setSelectedPlaceDetail] = useState(null);
  const [targetPlaceForMap, setTargetPlaceForMap] = useState(null);

  // トースト通知（alert()の代わりに使う軽量な通知）
  const [toastMessage, setToastMessage] = useState('');
  const toastTimerRef = useRef(null);
  const showToast = (message) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(message);
    toastTimerRef.current = setTimeout(() => setToastMessage(''), 3000);
  };
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // データのエクスポート／インポート用
  const importFileInputRef = useRef(null);

  // 1. ローカルストレージからの安全な復元
  useEffect(() => {
    try {
      const savedPlaces = localStorage.getItem(STORAGE_PLACES_KEY);
      const savedVisits = localStorage.getItem(STORAGE_VISITS_KEY);
      const savedWishlist = localStorage.getItem(STORAGE_WISHLIST_KEY);
      if (savedPlaces && savedVisits) {
        const parsedPlaces = JSON.parse(savedPlaces);
        const parsedVisits = JSON.parse(savedVisits);
        if (Array.isArray(parsedPlaces) && parsedPlaces.length > 0) {
          setPlaces(parsedPlaces);
        }
        if (Array.isArray(parsedVisits)) {
          setVisits(parsedVisits);
        }
      } else {
        localStorage.setItem(STORAGE_PLACES_KEY, JSON.stringify(INITIAL_PLACES));
        localStorage.setItem(STORAGE_VISITS_KEY, JSON.stringify(INITIAL_VISITS));
      }
      if (savedWishlist) {
        const parsedWishlist = JSON.parse(savedWishlist);
        if (Array.isArray(parsedWishlist)) {
          setWishlist(parsedWishlist);
        }
      } else {
        localStorage.setItem(STORAGE_WISHLIST_KEY, JSON.stringify(INITIAL_WISHLIST));
      }
    } catch (e) {
      console.warn('LocalStorage error, using initial data:', e);
    }
  }, []);

  const savePlaces = (newPlaces) => {
    setPlaces(newPlaces);
    try {
      localStorage.setItem(STORAGE_PLACES_KEY, JSON.stringify(newPlaces));
    } catch (e) {
      console.warn('Failed to save places:', e);
    }
  };

  const saveVisits = (newVisits) => {
    setVisits(newVisits);
    try {
      localStorage.setItem(STORAGE_VISITS_KEY, JSON.stringify(newVisits));
    } catch (e) {
      console.warn('Failed to save visits:', e);
      if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
        showToast('写真の容量が大きく、保存できませんでした。写真を減らすか画質を下げてお試しください。');
      } else {
        showToast('保存に失敗しました。');
      }
    }
  };

  const saveWishlist = (newWishlist) => {
    setWishlist(newWishlist);
    try {
      localStorage.setItem(STORAGE_WISHLIST_KEY, JSON.stringify(newWishlist));
    } catch (e) {
      console.warn('Failed to save wishlist:', e);
    }
  };

  // 2. Google Maps API スクリプトの安全な読み込み
  useEffect(() => {
    if (!apiKey) {
      setIsMapsLoaded(false);
      return;
    }

    if (window.google && window.google.maps && window.google.maps.places) {
      setIsMapsLoaded(true);
      return;
    }

    const scriptId = 'google-maps-loader-script';
    let script = document.getElementById(scriptId);

    window.gm_authFailure = () => {
      console.warn('Google Maps authentication failed. Please check your API key.');
      setIsMapsLoaded(false);
    };

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => setIsMapsLoaded(true);
      script.onerror = () => {
        console.warn('Failed to load Google Maps script');
        setIsMapsLoaded(false);
      };
      document.head.appendChild(script);
    } else {
      script.onload = () => setIsMapsLoaded(true);
    }
  }, [apiKey]);

  const handleSaveApiKey = (e) => {
    e.preventDefault();
    const key = apiKeyInput.trim();
    if (key) {
      try {
        localStorage.setItem(STORAGE_API_KEY, key);
      } catch (err) {}
      setApiKey(key);
      setShowApiKeyModal(false);
      setApiKeyInput('');
    }
  };

  // 3. データ集計（場所ごとの訪問回数、最終訪問日）
  const enrichedPlaces = useMemo(() => {
    const map = new Map();

    places.forEach(p => {
      map.set(p.id, {
        ...p,
        visits: [],
        lastVisited: '',
        visitCount: 0
      });
    });

    visits.forEach(v => {
      const p = map.get(v.placeId);
      if (p) {
        p.visits.push(v);
      }
    });

    return Array.from(map.values()).map(p => {
      p.visits.sort((a, b) => new Date(b.date) - new Date(a.date));
      p.visitCount = p.visits.length;
      p.lastVisited = p.visits.length > 0 ? p.visits[0].date : '';
      p.avgRating = p.visits.length > 0
        ? p.visits.reduce((sum, v) => sum + (v.rating || 0), 0) / p.visits.length
        : 0;
      return p;
    });
  }, [places, visits]);

  // 4. 年月ごとの訪問記録リスト（記録タブ）
  const groupedVisits = useMemo(() => {
    let list = visits.map(v => {
      const place = places.find(p => p.id === v.placeId);
      return {
        ...v,
        place: place || {
          name: '未登録の場所',
          address: '',
          category: 'other',
          lat: 0,
          lng: 0
        }
      };
    });

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(item =>
        item.place.name.toLowerCase().includes(q) ||
        (item.place.address && item.place.address.toLowerCase().includes(q)) ||
        (item.note && item.note.toLowerCase().includes(q))
      );
    }

    if (selectedCategory !== 'all') {
      list = list.filter(item => item.place.category === selectedCategory);
    }

    list.sort((a, b) => new Date(b.date) - new Date(a.date));

    const groups = {};
    list.forEach(item => {
      const d = parseLocalDate(item.date);
      const key = `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, '0')}月`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    return Object.entries(groups).map(([label, items]) => ({ label, items }));
  }, [visits, places, searchQuery, selectedCategory]);

  // 4b. 旅行（トリップ）単位でまとめる（記録タブ・旅行別表示）
  // 同じ国が続く範囲で、日付の間隔が一定以内ならひとつの旅行として束ねる
  const groupedVisitsByTrip = useMemo(() => {
    let list = visits.map(v => {
      const place = places.find(p => p.id === v.placeId);
      return {
        ...v,
        place: place || { name: '未登録の場所', address: '', category: 'other', lat: 0, lng: 0, country: '' }
      };
    });

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(item =>
        item.place.name.toLowerCase().includes(q) ||
        (item.place.address && item.place.address.toLowerCase().includes(q)) ||
        (item.note && item.note.toLowerCase().includes(q))
      );
    }
    if (selectedCategory !== 'all') {
      list = list.filter(item => item.place.category === selectedCategory);
    }

    // 旅行判定のため、まず日付の古い順に並べてグループを作る
    const ascending = [...list].sort((a, b) => new Date(a.date) - new Date(b.date));
    const TRIP_GAP_DAYS = 5;
    const trips = [];
    let current = null;

    ascending.forEach(item => {
      const country = item.place.country || 'その他';
      const itemDate = parseLocalDate(item.date);

      const gapDays = current
        ? Math.abs((itemDate.getTime() - parseLocalDate(current.lastDate).getTime()) / (1000 * 60 * 60 * 24))
        : Infinity;

      if (!current || current.country !== country || gapDays > TRIP_GAP_DAYS) {
        current = { country, firstDate: item.date, lastDate: item.date, items: [] };
        trips.push(current);
      }
      current.items.push(item);
      if (item.date > current.lastDate) current.lastDate = item.date;
      if (item.date < current.firstDate) current.firstDate = item.date;
    });

    // 新しい旅行が上に来るよう、旅行の並び・各旅行内の訪問の並びを新しい順に
    return trips
      .slice()
      .reverse()
      .map(trip => {
        const items = [...trip.items].sort((a, b) => new Date(b.date) - new Date(a.date));
        const period = trip.firstDate === trip.lastDate
          ? formatDateWithWeekday(trip.firstDate)
          : `${formatDateWithWeekday(trip.firstDate)} 〜 ${formatDateWithWeekday(trip.lastDate)}`;
        return {
          label: `${period}・${trip.country}`,
          items
        };
      });
  }, [visits, places, searchQuery, selectedCategory]);

  // 5. エリア別まとめ（場所タブ・訪問済み表示）
  const placesGroupedByArea = useMemo(() => {
    let list = enrichedPlaces.filter(p => p.visitCount > 0);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.address && p.address.toLowerCase().includes(q)) ||
        p.visits.some(v => v.note && v.note.toLowerCase().includes(q))
      );
    }

    if (selectedCategory !== 'all') {
      list = list.filter(p => p.category === selectedCategory);
    }

    list.sort((a, b) => {
      if (!a.lastVisited) return 1;
      if (!b.lastVisited) return -1;
      return new Date(b.lastVisited) - new Date(a.lastVisited);
    });

    const areaGroups = {};
    list.forEach(p => {
      const areaKey = p.administrativeArea ? `${p.country || ''} ${p.administrativeArea}`.trim() : (p.country || 'その他の地域');
      if (!areaGroups[areaKey]) areaGroups[areaKey] = [];
      areaGroups[areaKey].push(p);
    });

    return Object.entries(areaGroups).map(([area, items]) => ({ area, items }));
  }, [enrichedPlaces, searchQuery, selectedCategory]);

  // 5b. エリア別まとめ（場所タブ・行きたいリスト表示）
  const wishlistGroupedByArea = useMemo(() => {
    let list = wishlist;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.address && p.address.toLowerCase().includes(q)) ||
        (p.memo && p.memo.toLowerCase().includes(q))
      );
    }

    if (selectedCategory !== 'all') {
      list = list.filter(p => p.category === selectedCategory);
    }

    list = [...list].sort((a, b) => new Date(b.addedAt || 0) - new Date(a.addedAt || 0));

    const areaGroups = {};
    list.forEach(p => {
      const areaKey = p.administrativeArea ? `${p.country || ''} ${p.administrativeArea}`.trim() : (p.country || 'その他の地域');
      if (!areaGroups[areaKey]) areaGroups[areaKey] = [];
      areaGroups[areaKey].push(p);
    });

    return Object.entries(areaGroups).map(([area, items]) => ({ area, items }));
  }, [wishlist, searchQuery, selectedCategory]);

  // 5c. 現在地から近い「行きたい場所」（緯度経度を持つものだけが対象）
  const nearbyWishlist = useMemo(() => {
    if (!userLocation) return [];
    return wishlist
      .filter(w => typeof w.lat === 'number' && typeof w.lng === 'number')
      .map(w => ({
        ...w,
        distanceMeters: calculateDistanceMeters(userLocation.lat, userLocation.lng, w.lat, w.lng)
      }))
      .filter(w => (nearbyRadiusFilter ? w.distanceMeters <= nearbyRadiusFilter : true))
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
  }, [wishlist, userLocation, nearbyRadiusFilter]);

  // 6. 削除ハンドラー
  const handleDeleteVisit = (visitId) => {
    setConfirmDialog({
      title: '訪問記録の削除',
      message: 'この訪問記録を削除してもよろしいですか？',
      onConfirm: () => {
        const next = visits.filter(v => v.id !== visitId);
        saveVisits(next);
      }
    });
  };

  const handleDeletePlace = (placeId) => {
    setConfirmDialog({
      title: '場所と記録の削除',
      message: 'この場所と関連するすべての訪問履歴が完全に削除されます。よろしいですか？',
      onConfirm: () => {
        const nextPlaces = places.filter(p => p.id !== placeId);
        const nextVisits = visits.filter(v => v.placeId !== placeId);
        savePlaces(nextPlaces);
        saveVisits(nextVisits);
        if (selectedPlaceDetail?.id === placeId) setSelectedPlaceDetail(null);
      }
    });
  };

  const handleJumpToMap = (place) => {
    setTargetPlaceForMap(place);
    setActiveTab('map');
  };

  // 行きたい場所リストの削除・「行った！」への変換
  const handleDeleteWishlistItem = (wishId) => {
    setConfirmDialog({
      title: '行きたい場所の削除',
      message: 'この行きたい場所をリストから削除してもよろしいですか？',
      onConfirm: () => {
        saveWishlist(wishlist.filter(w => w.id !== wishId));
      }
    });
  };

  const handleConvertWishlistToVisit = (wishItem) => {
    setConvertingWishlistId(wishItem.id);
    setEditingVisit(null);
    setEditingPlace({
      id: generateUUID(),
      googlePlaceId: wishItem.googlePlaceId,
      name: wishItem.name,
      address: wishItem.address,
      lat: wishItem.lat,
      lng: wishItem.lng,
      googleMapsUrl: wishItem.googleMapsUrl,
      category: wishItem.category,
      country: wishItem.country,
      administrativeArea: wishItem.administrativeArea,
      locality: wishItem.locality
    });
    setIsRecordModalOpen(true);
  };

  // 現在地から「行きたい場所」を近い順に確認する
  const handleFindNearbyWishlist = () => {
    if (!navigator.geolocation) {
      setNearbyError('この端末・ブラウザでは現在地を取得できません。');
      return;
    }
    setIsLocatingNearby(true);
    setNearbyError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setIsLocatingNearby(false);
        setIsNearbyPanelOpen(true);
      },
      () => {
        setIsLocatingNearby(false);
        setNearbyError('現在地を取得できませんでした。位置情報の利用を許可しているかご確認ください。');
      },
      { timeout: 8000 }
    );
  };

  // 7. データのバックアップ（エクスポート／インポート）
  const handleExportData = () => {
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        places,
        visits,
        wishlist
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `odekake-log-backup-${getTodayDateString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('バックアップファイルをダウンロードしました。');
    } catch (e) {
      console.warn('Export failed:', e);
      showToast('エクスポートに失敗しました。');
    }
  };

  const handleImportFileSelected = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 同じファイルを選び直せるようにリセット
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const importedPlaces = Array.isArray(parsed?.places) ? parsed.places : null;
        const importedVisits = Array.isArray(parsed?.visits) ? parsed.visits : null;
        const importedWishlist = Array.isArray(parsed?.wishlist) ? parsed.wishlist : [];

        if (!importedPlaces || !importedVisits) {
          showToast('バックアップファイルの形式が正しくありません。');
          return;
        }

        setConfirmDialog({
          title: 'データの復元',
          message: `現在のデータ（場所${places.length}件・記録${visits.length}件・行きたい場所${wishlist.length}件）を、バックアップの内容（場所${importedPlaces.length}件・記録${importedVisits.length}件・行きたい場所${importedWishlist.length}件）で置き換えます。よろしいですか？`,
          onConfirm: () => {
            savePlaces(importedPlaces);
            saveVisits(importedVisits);
            saveWishlist(importedWishlist);
            showToast('データを復元しました。');
          }
        });
      } catch (err) {
        console.warn('Import failed:', err);
        showToast('ファイルの読み込みに失敗しました。JSON形式のバックアップファイルを選んでください。');
      }
    };
    reader.onerror = () => showToast('ファイルの読み込みに失敗しました。');
    reader.readAsText(file);
  };

  return (
    <div className="flex justify-center bg-neutral-100 min-h-screen font-sans text-neutral-800 antialiased">
      <div className="w-full max-w-md lg:max-w-6xl bg-[#fafafa] min-h-screen flex flex-col shadow-xl lg:shadow-none relative pb-20 lg:pb-8 border-x lg:border-x-0 border-neutral-200">

        {/* ヘッダー */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md px-4 lg:px-8 py-3 border-b border-neutral-200 flex items-center justify-between">
          <div className="flex items-center gap-2 lg:gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-sky-500 text-white flex items-center justify-center shadow-sm">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-sm font-black text-neutral-900 tracking-tight">おでかけログ</h1>
                <p className="text-[10px] text-neutral-400 font-medium hidden sm:block">Googleマップ検索・訪問記録</p>
              </div>
            </div>

            {/* デスクトップ用のタブ切り替え（画面幅が広いときはヘッダー内に表示） */}
            <nav className="hidden lg:flex items-center gap-1 bg-neutral-100 rounded-full p-1">
              {[
                { key: 'logs', label: '記録', icon: Calendar },
                { key: 'places', label: '場所', icon: Clock },
                { key: 'map', label: 'マップ', icon: MapIcon }
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
                    activeTab === key ? 'bg-white text-sky-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-1.5">
            {/* APIキー設定ボタン */}
            <button
              onClick={() => setShowApiKeyModal(true)}
              className={`p-1.5 rounded-lg border transition-colors ${
                apiKey ? 'border-neutral-200 text-neutral-500 hover:bg-neutral-50' : 'border-amber-300 bg-amber-50 text-amber-600'
              }`}
              title="Google Maps APIキー設定"
            >
              <Key className="w-4 h-4" />
            </button>

            {/* 新規登録ボタン */}
            <button
              onClick={() => {
                setEditingVisit(null);
                setEditingPlace(null);
                setIsRecordModalOpen(true);
              }}
              className="flex items-center gap-1 bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>記録する</span>
            </button>
          </div>
        </header>

        {/* APIキー未設定の案内バー（アプリはそのまま動作可能） */}
        {!apiKey && (
          <div className="bg-amber-50/90 border-b border-amber-200 px-4 lg:px-8 py-2 flex items-center justify-between text-xs text-amber-800">
            <div className="flex items-center gap-1.5 text-[11px]">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
              <span>APIキー未設定：デモ候補検索＆簡易マップで動作中</span>
            </div>
            <button
              onClick={() => setShowApiKeyModal(true)}
              className="text-[11px] font-bold underline text-amber-900 ml-2"
            >
              設定
            </button>
          </div>
        )}

        {/* メインエリア */}
        <main className="flex-1 overflow-y-auto px-4 lg:px-8 py-3 lg:py-5">

          {/* 検索・絞り込み（記録・場所タブ） */}
          {activeTab !== 'map' && (
            <div className="mb-3 space-y-2 lg:max-w-md">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="店名、住所、メモから検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white pl-9 pr-8 py-2 rounded-xl border border-neutral-200 text-xs focus:outline-none focus:border-sky-400 shadow-sm"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap ${
                    selectedCategory === 'all'
                      ? 'bg-neutral-800 text-white'
                      : 'bg-white text-neutral-600 border border-neutral-200'
                  }`}
                >
                  すべて
                </button>
                {Object.entries(CATEGORIES).map(([k, cat]) => (
                  <button
                    key={k}
                    onClick={() => setSelectedCategory(k)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap flex items-center gap-1 border ${
                      selectedCategory === k
                        ? `${cat.bg} ${cat.text} ${cat.border} ring-1 ring-current`
                        : 'bg-white text-neutral-600 border-neutral-200'
                    }`}
                  >
                    <cat.icon className="w-3 h-3" />
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 1: 記録（日付順・年月別 or 旅行別まとめ） */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              <div className="flex items-center gap-1 bg-neutral-100 rounded-full p-1 w-fit text-xs">
                <button
                  onClick={() => setLogsGroupBy('month')}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full font-bold transition-colors ${
                    logsGroupBy === 'month' ? 'bg-white text-sky-600 shadow-sm' : 'text-neutral-500'
                  }`}
                >
                  <Calendar className="w-3 h-3" />
                  <span>月別</span>
                </button>
                <button
                  onClick={() => setLogsGroupBy('trip')}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full font-bold transition-colors ${
                    logsGroupBy === 'trip' ? 'bg-white text-sky-600 shadow-sm' : 'text-neutral-500'
                  }`}
                >
                  <Plane className="w-3 h-3" />
                  <span>旅行別</span>
                </button>
              </div>

              {(logsGroupBy === 'trip' ? groupedVisitsByTrip : groupedVisits).length === 0 ? (
                <div className="py-16 text-center text-neutral-400 text-xs">
                  記録がありません。「記録する」ボタンから訪れた場所を追加してください。
                </div>
              ) : (
                (logsGroupBy === 'trip' ? groupedVisitsByTrip : groupedVisits).map(({ label, items }) => (
                  <div key={label} className="space-y-2.5">
                    <div className="sticky top-[53px] z-10 bg-[#fafafa]/90 backdrop-blur-sm py-1 flex items-center justify-between">
                      <span className="text-xs font-black text-neutral-700 bg-neutral-200/80 px-2.5 py-0.5 rounded-md">
                        {label}
                      </span>
                      <span className="text-[11px] text-neutral-400 font-medium">
                        {items.length} 件の訪問
                      </span>
                    </div>

                    <div className="space-y-2.5 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0 xl:grid-cols-3">
                    {items.map((item) => {
                      const cat = CATEGORIES[item.place.category] || CATEGORIES.other;
                      const formattedDate = formatDateWithWeekday(item.date);
                      const relativeDays = getRelativeDays(item.date);

                      return (
                        <div
                          key={item.id}
                          className="bg-white rounded-2xl p-4 border border-neutral-200/80 shadow-sm hover:border-neutral-300 transition-all cursor-pointer"
                          onClick={() => setSelectedPlaceDetail(item.place)}
                        >
                          {/* 訪問日ヘッダー */}
                          <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-sky-500" />
                              <span className="text-xs font-bold text-neutral-800">
                                {formattedDate}
                              </span>
                            </div>
                            <span className="text-[10px] font-semibold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
                              {relativeDays}
                            </span>
                          </div>

                          {/* 店名・カテゴリー */}
                          <div className="mt-2.5 flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${cat.bg} ${cat.text} ${cat.border} flex-shrink-0`}>
                                  <cat.icon className="w-3 h-3" />
                                  {cat.label}
                                </span>
                                <h2 className="text-sm font-bold text-neutral-900 truncate">
                                  {item.place.name}
                                </h2>
                              </div>
                              <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                                {item.place.address || '住所情報なし'}
                              </p>
                            </div>

                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                              {/* 写真がある場合のみ、控えめに1枚目をサムネイル表示 */}
                              {item.photos && item.photos.length > 0 && (
                                <div className="relative w-11 h-11 rounded-lg overflow-hidden border border-neutral-200 bg-neutral-100">
                                  <img src={item.photos[0]} alt="" className="w-full h-full object-cover" />
                                  {item.photos.length > 1 && (
                                    <span className="absolute bottom-0 right-0 bg-black/60 text-white text-[8px] font-bold px-1 leading-[14px] rounded-tl">
                                      +{item.photos.length - 1}
                                    </span>
                                  )}
                                </div>
                              )}
                              <div className="flex text-amber-400 text-xs">
                                {'★'.repeat(item.rating || 5)}
                              </div>
                            </div>
                          </div>

                          {item.note && (
                            <p className="text-xs text-neutral-600 mt-2 bg-neutral-50 p-2.5 rounded-xl border border-neutral-100 leading-relaxed">
                              {item.note}
                            </p>
                          )}

                          <div className="mt-3 pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px]" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleJumpToMap(item.place)}
                              className="text-sky-600 hover:text-sky-700 font-semibold flex items-center gap-1"
                            >
                              <MapIcon className="w-3.5 h-3.5" />
                              <span>マップで見る</span>
                            </button>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setEditingVisit(item);
                                  setEditingPlace(item.place);
                                  setIsRecordModalOpen(true);
                                }}
                                className="text-neutral-500 hover:text-neutral-800 p-1 flex items-center gap-0.5"
                                title="記録を編集"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                <span>編集</span>
                              </button>
                              <button
                                onClick={() => handleDeleteVisit(item.id)}
                                className="text-neutral-400 hover:text-red-600 p-1"
                                title="記録を削除"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: 場所（訪問済み／行きたいリストの切り替え） */}
          {activeTab === 'places' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1 bg-neutral-100 rounded-full p-1 text-xs">
                  <button
                    onClick={() => setPlacesSubView('visited')}
                    className={`flex items-center gap-1 px-3 py-1 rounded-full font-bold transition-colors ${
                      placesSubView === 'visited' ? 'bg-white text-sky-600 shadow-sm' : 'text-neutral-500'
                    }`}
                  >
                    <Compass className="w-3 h-3" />
                    <span>訪問済み ({placesGroupedByArea.reduce((n, g) => n + g.items.length, 0)})</span>
                  </button>
                  <button
                    onClick={() => setPlacesSubView('wishlist')}
                    className={`flex items-center gap-1 px-3 py-1 rounded-full font-bold transition-colors ${
                      placesSubView === 'wishlist' ? 'bg-white text-sky-600 shadow-sm' : 'text-neutral-500'
                    }`}
                  >
                    <Bookmark className="w-3 h-3" />
                    <span>行きたい ({wishlist.length})</span>
                  </button>
                </div>

                {placesSubView === 'wishlist' && (
                  <button
                    onClick={() => setIsWishlistModalOpen(true)}
                    className="flex items-center gap-1 bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm transition-all active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>行きたい場所を追加</span>
                  </button>
                )}
              </div>

              {placesSubView === 'visited' ? (
                placesGroupedByArea.length === 0 ? (
                  <div className="py-16 text-center text-neutral-400 text-xs">
                    登録されている場所がありません。
                  </div>
                ) : (
                  placesGroupedByArea.map(({ area, items }) => (
                    <div key={area} className="space-y-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-black text-neutral-700 px-1">
                        <Compass className="w-3.5 h-3.5 text-sky-500" />
                        <span>{area}</span>
                        <span className="text-neutral-400 font-normal">({items.length}箇所)</span>
                      </div>

                      <div className="space-y-2.5 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0 xl:grid-cols-3">
                      {items.map((place) => {
                        const cat = CATEGORIES[place.category] || CATEGORIES.other;
                        const lastFormatted = place.lastVisited ? formatDateWithWeekday(place.lastVisited) : '未訪問';
                        const lastRelative = place.lastVisited ? getRelativeDays(place.lastVisited) : '';

                        return (
                          <div
                            key={place.id}
                            onClick={() => setSelectedPlaceDetail(place)}
                            className="bg-white rounded-2xl p-5 border border-neutral-200/80 shadow-sm hover:border-neutral-300 transition-all cursor-pointer"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${cat.bg} ${cat.text} ${cat.border}`}>
                                  <cat.icon className="w-3 h-3" />
                                  {cat.label}
                                </span>
                                <h3 className="text-sm font-bold text-neutral-900 leading-snug mt-1.5">
                                  {place.name}
                                </h3>
                                <p className="text-[11px] text-neutral-400 mt-1 truncate">
                                  {place.address || '住所未登録'}
                                </p>
                              </div>

                              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                <span className="text-xs font-black text-sky-700 bg-sky-50 px-2.5 py-1 rounded-full border border-sky-100 whitespace-nowrap">
                                  計 {place.visitCount} 回
                                </span>
                                <ChevronRight className="w-4 h-4 text-neutral-300" />
                              </div>
                            </div>

                            {/* 集計サマリー（詳細な訪問履歴は「記録」タブかカードをタップして確認） */}
                            <div className="mt-3.5 flex items-center justify-between text-xs bg-neutral-50 p-2.5 rounded-xl border border-neutral-150">
                              <span className="font-medium text-neutral-600 flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-sky-500" />
                                最後に訪れた日:
                              </span>
                              <div className="text-right">
                                <span className="font-bold text-neutral-800">{lastFormatted}</span>
                                {lastRelative && (
                                  <span className="text-[11px] text-neutral-400 ml-1">({lastRelative})</span>
                                )}
                              </div>
                            </div>
                            <div className="mt-1.5 flex items-center gap-1 px-0.5 text-[11px] text-neutral-500">
                              <span className="text-amber-400">{'★'.repeat(Math.round(place.avgRating) || 0)}</span>
                              <span>平均評価 {place.avgRating.toFixed(1)}</span>
                            </div>

                            {/* アクションバー：主要な操作だけに絞る（削除は詳細画面から） */}
                            <div
                              className="mt-3.5 pt-3 border-t border-neutral-100 flex items-center gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {place.googleMapsUrl && (
                                <a
                                  href={place.googleMapsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-neutral-600 hover:text-neutral-900 font-semibold flex items-center gap-1 text-[11px]"
                                >
                                  <ExternalLink className="w-3 h-3 text-neutral-400" />
                                  <span>Googleマップ</span>
                                </a>
                              )}
                              <button
                                onClick={() => handleJumpToMap(place)}
                                className="text-neutral-400 hover:text-sky-600 p-1 flex-shrink-0"
                                title="マップでピンを見る"
                              >
                                <MapIcon className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingVisit(null);
                                  setEditingPlace(place);
                                  setIsRecordModalOpen(true);
                                }}
                                className="ml-auto bg-sky-50 text-sky-700 border border-sky-200 px-3 py-1 rounded-lg text-[11px] font-bold hover:bg-sky-100 flex-shrink-0"
                              >
                                ＋ 再訪を記録
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      </div>
                    </div>
                  ))
                )
              ) : (
                <>
                {/* 近くの保存済みスポット（現在地から距離順に確認） */}
                <div className="bg-sky-50/70 border border-sky-200 rounded-2xl p-3.5 space-y-2.5">
                  {!userLocation ? (
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 text-xs text-sky-900 font-bold">
                        <Navigation className="w-3.5 h-3.5 text-sky-600" />
                        <span>近くの保存済みスポットを確認</span>
                      </div>
                      <button
                        onClick={handleFindNearbyWishlist}
                        disabled={isLocatingNearby}
                        className="bg-sky-500 hover:bg-sky-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-full disabled:opacity-60 flex items-center gap-1"
                      >
                        {isLocatingNearby && <RefreshCw className="w-3 h-3 animate-spin" />}
                        <span>{isLocatingNearby ? '取得中...' : '現在地から探す'}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <button
                        type="button"
                        onClick={() => setIsNearbyPanelOpen(v => !v)}
                        className="w-full flex items-center justify-between gap-2 text-left"
                      >
                        <span className="flex items-center gap-1.5 text-xs font-bold text-sky-900">
                          <Navigation className="w-3.5 h-3.5 text-sky-600 flex-shrink-0" />
                          <span>近くに保存済みの場所が {nearbyWishlist.length} 件あります</span>
                        </span>
                        <ChevronDown className={`w-4 h-4 text-sky-600 flex-shrink-0 transition-transform ${isNearbyPanelOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {isNearbyPanelOpen && (
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] pb-0.5">
                            {[
                              { label: '500m以内', value: 500 },
                              { label: '1km以内', value: 1000 },
                              { label: '3km以内', value: 3000 },
                              { label: 'すべて', value: null }
                            ].map((opt) => (
                              <button
                                key={opt.label}
                                onClick={() => setNearbyRadiusFilter(opt.value)}
                                className={`px-2.5 py-1 rounded-full font-bold whitespace-nowrap border transition-colors ${
                                  nearbyRadiusFilter === opt.value
                                    ? 'bg-sky-600 text-white border-sky-600'
                                    : 'bg-white text-neutral-600 border-neutral-200'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                            <button
                              onClick={handleFindNearbyWishlist}
                              className="ml-auto flex-shrink-0 flex items-center gap-1 text-sky-700 font-bold px-2 py-1"
                            >
                              <RefreshCw className={`w-3 h-3 ${isLocatingNearby ? 'animate-spin' : ''}`} />
                              <span>現在地を更新</span>
                            </button>
                          </div>

                          {nearbyWishlist.length === 0 ? (
                            <div className="text-center text-[11px] text-neutral-400 py-6">
                              この範囲に保存済みの行きたい場所はありません。
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {nearbyWishlist.map((wish) => {
                                const cat = CATEGORIES[wish.category] || CATEGORIES.other;
                                return (
                                  <div key={wish.id} className="bg-white p-3 rounded-xl border border-sky-100 space-y-1.5">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${cat.bg} ${cat.text} ${cat.border} flex-shrink-0`}>
                                            <cat.icon className="w-2.5 h-2.5" />
                                            {cat.label}
                                          </span>
                                          <span className="text-xs font-bold text-neutral-900 truncate">{wish.name}</span>
                                        </div>
                                        <p className="text-[11px] text-neutral-400 mt-0.5 truncate">{wish.address}</p>
                                      </div>
                                      <span className="text-[11px] font-black text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-100 whitespace-nowrap flex-shrink-0">
                                        {formatDistance(wish.distanceMeters)}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between pt-1.5 border-t border-neutral-100 text-[11px]">
                                      {wish.googleMapsUrl ? (
                                        <a
                                          href={wish.googleMapsUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-neutral-600 hover:text-neutral-900 font-semibold flex items-center gap-1"
                                        >
                                          <ExternalLink className="w-3 h-3 text-neutral-400" />
                                          <span>Googleマップ</span>
                                        </a>
                                      ) : <span />}
                                      <button
                                        onClick={() => handleConvertWishlistToVisit(wish)}
                                        className="bg-sky-500 hover:bg-sky-600 text-white px-2.5 py-1 rounded-lg font-bold flex items-center gap-1"
                                      >
                                        <Sparkles className="w-3 h-3" />
                                        <span>訪問を記録</span>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {nearbyError && (
                    <div className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5">
                      {nearbyError}
                    </div>
                  )}
                </div>

                {wishlistGroupedByArea.length === 0 ? (
                  <div className="py-16 text-center text-neutral-400 text-xs">
                    行きたい場所がまだありません。「行きたい場所を追加」から気になるお店を保存してみましょう。
                  </div>
                ) : (
                  wishlistGroupedByArea.map(({ area, items }) => (
                    <div key={area} className="space-y-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-black text-neutral-700 px-1">
                        <Compass className="w-3.5 h-3.5 text-sky-500" />
                        <span>{area}</span>
                        <span className="text-neutral-400 font-normal">({items.length}箇所)</span>
                      </div>

                      <div className="space-y-2.5 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0 xl:grid-cols-3">
                      {items.map((wish) => {
                        const cat = CATEGORIES[wish.category] || CATEGORIES.other;
                        return (
                          <div
                            key={wish.id}
                            className="bg-white rounded-2xl p-4 border border-neutral-200/80 shadow-sm hover:border-neutral-300 transition-all"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${cat.bg} ${cat.text} ${cat.border} flex-shrink-0`}>
                                    <cat.icon className="w-3 h-3" />
                                    {cat.label}
                                  </span>
                                  <h3 className="text-sm font-bold text-neutral-900 truncate">
                                    {wish.name}
                                  </h3>
                                </div>
                                <p className="text-[11px] text-neutral-400 mt-1 truncate">
                                  {wish.address || '住所未登録'}
                                </p>
                              </div>
                              <Bookmark className="w-4 h-4 text-sky-400 flex-shrink-0" fill="currentColor" />
                            </div>

                            {wish.memo && (
                              <p className="text-xs text-neutral-600 mt-2.5 bg-neutral-50 p-2.5 rounded-xl border border-neutral-100 leading-relaxed">
                                {wish.memo}
                              </p>
                            )}

                            <div className="mt-3 pt-2.5 border-t border-neutral-100 flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                {wish.googleMapsUrl && (
                                  <a
                                    href={wish.googleMapsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-neutral-600 hover:text-neutral-900 font-semibold flex items-center gap-1 text-[11px]"
                                  >
                                    <ExternalLink className="w-3 h-3 text-neutral-400" />
                                    <span>Googleマップ</span>
                                  </a>
                                )}
                                <button
                                  onClick={() => handleDeleteWishlistItem(wish.id)}
                                  className="text-neutral-400 hover:text-red-600 p-1"
                                  title="行きたい場所から削除"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <button
                                onClick={() => handleConvertWishlistToVisit(wish)}
                                className="bg-sky-500 hover:bg-sky-600 text-white px-3 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1"
                              >
                                <Sparkles className="w-3 h-3" />
                                <span>行った！を記録</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      </div>
                    </div>
                  ))
                )}
                </>
              )}
            </div>
          )}

          {/* TAB 3: マップ（Googleマップ連携 / フォールバック対応） */}
          {activeTab === 'map' && (
            <MapViewerComponent
              isLoaded={isMapsLoaded}
              apiKey={apiKey}
              places={enrichedPlaces}
              wishlist={wishlist}
              targetPlace={targetPlaceForMap}
              onToast={showToast}
              onSelectPlace={(p) => setSelectedPlaceDetail(p)}
              onConvertWishlistToVisit={handleConvertWishlistToVisit}
              onRequestAddSpot={(lat, lng, address) => {
                setEditingVisit(null);
                setEditingPlace({
                  id: generateUUID(),
                  googlePlaceId: '',
                  name: address || '指定地点',
                  address: address || '',
                  lat,
                  lng,
                  googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
                  category: 'other',
                  country: '日本',
                  administrativeArea: '',
                  locality: ''
                });
                setIsRecordModalOpen(true);
              }}
              onOpenApiKeyModal={() => setShowApiKeyModal(true)}
            />
          )}

        </main>

        {/* 下部ナビゲーション（記録 / 場所 / マップ） */}
        <nav className="lg:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white/95 backdrop-blur-md border-t border-neutral-200 px-8 py-2 flex items-center justify-between z-40 shadow-lg">
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex flex-col items-center gap-1 transition-colors ${
              activeTab === 'logs' ? 'text-sky-600 font-bold' : 'text-neutral-400 hover:text-neutral-600 font-medium'
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span className="text-[11px]">記録</span>
          </button>

          <button
            onClick={() => setActiveTab('places')}
            className={`flex flex-col items-center gap-1 transition-colors ${
              activeTab === 'places' ? 'text-sky-600 font-bold' : 'text-neutral-400 hover:text-neutral-600 font-medium'
            }`}
          >
            <Clock className="w-5 h-5" />
            <span className="text-[11px]">場所</span>
          </button>

          <button
            onClick={() => setActiveTab('map')}
            className={`flex flex-col items-center gap-1 transition-colors ${
              activeTab === 'map' ? 'text-sky-600 font-bold' : 'text-neutral-400 hover:text-neutral-600 font-medium'
            }`}
          >
            <MapIcon className="w-5 h-5" />
            <span className="text-[11px]">マップ</span>
          </button>
        </nav>

        {/* 新規登録モーダル */}
        {isRecordModalOpen && (
          <RecordFormModal
            isOpen={isRecordModalOpen}
            onClose={() => {
              setIsRecordModalOpen(false);
              setEditingVisit(null);
              setEditingPlace(null);
              setConvertingWishlistId(null);
            }}
            initialVisit={editingVisit}
            initialPlace={editingPlace}
            places={places}
            isMapsLoaded={isMapsLoaded}
            onOpenApiKeyModal={() => setShowApiKeyModal(true)}
            onToast={showToast}
            onSave={({ placeData, visitData }) => {
              let targetPlaceId = placeData.id;
              let updatedPlaces = [...places];

              const existingIndex = placeData.googlePlaceId
                ? places.findIndex(p => p.googlePlaceId === placeData.googlePlaceId)
                : places.findIndex(p => p.id === placeData.id);

              if (existingIndex >= 0) {
                targetPlaceId = places[existingIndex].id;
                updatedPlaces[existingIndex] = {
                  ...places[existingIndex],
                  ...placeData,
                  id: targetPlaceId
                };
              } else {
                updatedPlaces.push(placeData);
              }
              savePlaces(updatedPlaces);

              let updatedVisits = [...visits];
              if (editingVisit) {
                updatedVisits = updatedVisits.map(v =>
                  v.id === editingVisit.id
                    ? { ...v, ...visitData, placeId: targetPlaceId }
                    : v
                );
              } else {
                updatedVisits.push({
                  ...visitData,
                  id: generateUUID(),
                  placeId: targetPlaceId
                });
              }
              saveVisits(updatedVisits);

              if (convertingWishlistId) {
                saveWishlist(wishlist.filter(w => w.id !== convertingWishlistId));
                showToast('行きたい場所リストから訪問記録に変換しました。');
              }

              setIsRecordModalOpen(false);
              setEditingVisit(null);
              setEditingPlace(null);
              setConvertingWishlistId(null);
            }}
          />
        )}

        {/* 行きたい場所を追加するモーダル */}
        {isWishlistModalOpen && (
          <WishlistFormModal
            onClose={() => setIsWishlistModalOpen(false)}
            isMapsLoaded={isMapsLoaded}
            onOpenApiKeyModal={() => setShowApiKeyModal(true)}
            onToast={showToast}
            onSave={(wishData) => {
              // 同じ場所（googlePlaceId）が既にリストにあれば重複登録しない
              const existingIndex = wishlist.findIndex(w => w.googlePlaceId === wishData.googlePlaceId);
              if (existingIndex >= 0) {
                showToast('この場所は既に行きたいリストに入っています。');
                setIsWishlistModalOpen(false);
                return;
              }
              saveWishlist([...wishlist, wishData]);
              setIsWishlistModalOpen(false);
              showToast('行きたいリストに追加しました。');
            }}
          />
        )}

        {/* 場所詳細モーダル */}
        {selectedPlaceDetail && (
          <PlaceDetailModal
            place={enrichedPlaces.find(p => p.id === selectedPlaceDetail.id) || selectedPlaceDetail}
            onClose={() => setSelectedPlaceDetail(null)}
            onJumpToMap={() => {
              handleJumpToMap(selectedPlaceDetail);
              setSelectedPlaceDetail(null);
            }}
            onAddVisit={() => {
              setEditingVisit(null);
              setEditingPlace(selectedPlaceDetail);
              setSelectedPlaceDetail(null);
              setIsRecordModalOpen(true);
            }}
            onDeletePlace={() => handleDeletePlace(selectedPlaceDetail.id)}
          />
        )}

        {/* 削除確認ダイアログ */}
        {confirmDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl max-w-xs w-full p-5 shadow-2xl">
              <h4 className="text-sm font-bold text-neutral-900 mb-1">{confirmDialog.title}</h4>
              <p className="text-xs text-neutral-500 mb-4 leading-relaxed">{confirmDialog.message}</p>
              <div className="flex justify-end gap-2 text-xs font-semibold">
                <button
                  onClick={() => setConfirmDialog(null)}
                  className="px-3 py-1.5 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => {
                    confirmDialog.onConfirm();
                    setConfirmDialog(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700"
                >
                  削除する
                </button>
              </div>
            </div>
          </div>
        )}

        {/* APIキー設定モーダル */}
        {showApiKeyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-neutral-150 pb-2">
                <div className="flex items-center gap-1.5 text-neutral-900 font-bold text-sm">
                  <Key className="w-4 h-4 text-sky-500" />
                  <span>Google Maps APIキー</span>
                </div>
                <button onClick={() => setShowApiKeyModal(false)} className="text-neutral-400 p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-neutral-500 leading-relaxed">
                Google Maps PlatformのAPIキーを入力すると、リアルタイム検索とピン地図が完全に有効化されます。
              </p>

              <form onSubmit={handleSaveApiKey} className="space-y-3">
                <input
                  type="text"
                  required
                  placeholder="AIzaSy..."
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-800 focus:outline-none focus:border-sky-500"
                />

                <div className="flex justify-end gap-2 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setShowApiKeyModal(false)}
                    className="px-3 py-1.5 rounded-lg border border-neutral-200 text-neutral-600"
                  >
                    閉じる
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-sky-500 text-white font-bold hover:bg-sky-600"
                  >
                    保存して適用
                  </button>
                </div>
              </form>

              <div className="pt-3 border-t border-neutral-150 space-y-2">
                <div className="text-xs font-bold text-neutral-700">データのバックアップ</div>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  登録した場所・訪問記録はこの端末のブラウザ内にのみ保存されています。機種変更やブラウザの変更に備えて、JSONファイルとして書き出し・読み込みができます。
                </p>
                <div className="flex gap-2 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={handleExportData}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>エクスポート</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => importFileInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>インポート</span>
                  </button>
                  <input
                    ref={importFileInputRef}
                    type="file"
                    accept="application/json,.json"
                    onChange={handleImportFileSelected}
                    className="hidden"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* トースト通知（alertの代わりの軽量な通知） */}
        {toastMessage && (
          <div className="fixed bottom-24 lg:bottom-8 left-1/2 -translate-x-1/2 z-[60] max-w-[90%] px-4 py-2.5 rounded-xl bg-neutral-900/95 text-white text-xs font-semibold shadow-xl text-center">
            {toastMessage}
          </div>
        )}

      </div>
    </div>
  );
}

// ==========================================
// お店・場所を検索して選ぶための共通フィールド
// （記録モーダル・行きたい場所モーダルの両方で使う）
// ==========================================
function PlaceSearchField({
  isMapsLoaded,
  onOpenApiKeyModal,
  category,
  selectedPlace,
  onSelectedPlaceChange,
  isLocked = false,
  onUnlock,
  lockedLabel = '記録する場所'
}) {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [predictions, setPredictions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // フォールバック用の人気プリセット候補（APIキー未設定時でも動作確認可能）
  const MOCK_PRESETS = useMemo(() => [
    { name: 'スターバックス コーヒー 渋谷TSUTAYA店', address: '東京都渋谷区宇田川町21-6', lat: 35.6598, lng: 139.7006, cat: 'cafe' },
    { name: 'ブルーボトルコーヒー 清澄白河フラッグシップカフェ', address: '東京都江東区平野1-4-8', lat: 35.6812, lng: 139.8005, cat: 'cafe' },
    { name: 'SHIBUYA SKY (展望台)', address: '東京都渋谷区渋谷2-24-12', lat: 35.6585, lng: 139.7023, cat: 'sightseeing' },
    { name: '東京タワー', address: '東京都港区芝公園4丁目2-8', lat: 35.6586, lng: 139.7454, cat: 'sightseeing' },
    { name: '一蘭 新宿中央東口店', address: '東京都新宿区新宿3-34-11', lat: 35.6896, lng: 139.7027, cat: 'food' },
    { name: '帝国ホテル 東京', address: '東京都千代田区内幸町1-1-1', lat: 35.6725, lng: 139.7592, cat: 'hotel' }
  ], []);

  const autocompleteServiceRef = useRef(null);
  const placesServiceRef = useRef(null);
  const dummyDivRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const isComposingRef = useRef(false);
  const searchRequestIdRef = useRef(0);

  useEffect(() => {
    if (isMapsLoaded && window.google?.maps?.places) {
      try {
        autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
        if (dummyDivRef.current) {
          placesServiceRef.current = new window.google.maps.places.PlacesService(dummyDivRef.current);
        }
      } catch (e) {
        console.warn('PlacesService init failed', e);
      }
    }
  }, [isMapsLoaded]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const runSearch = (val) => {
    if (!val.trim()) {
      setPredictions([]);
      setIsSearching(false);
      return;
    }

    const requestId = ++searchRequestIdRef.current;

    // Google Places API が利用可能な場合
    if (autocompleteServiceRef.current && isMapsLoaded) {
      setIsSearching(true);
      autocompleteServiceRef.current.getPlacePredictions(
        { input: val },
        (results, status) => {
          // 古いリクエストの結果が後から返って新しい入力を上書きしないようにする
          if (requestId !== searchRequestIdRef.current) return;
          setIsSearching(false);
          if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
            setPredictions(results.map(r => ({
              isRealGoogle: true,
              place_id: r.place_id,
              name: r.structured_formatting?.main_text || r.description,
              secondary: r.structured_formatting?.secondary_text || ''
            })));
          } else {
            setPredictions([]);
          }
        }
      );
    } else {
      // APIキー未設定時のスマートフォールバック（プリセット＋入力文字での新規作成）
      // 同じ店を何度選んでも同じ googlePlaceId になるよう、名前から安定IDを作る
      const slugify = (s) => s.trim().toLowerCase().replace(/\s+/g, '-');

      const filteredPresets = MOCK_PRESETS.filter(p =>
        p.name.toLowerCase().includes(val.toLowerCase()) ||
        p.address.toLowerCase().includes(val.toLowerCase())
      ).map(p => ({
        isRealGoogle: false,
        place_id: `mock-${slugify(p.name)}`,
        name: p.name,
        secondary: p.address,
        mockData: p
      }));

      // ユーザーが入力した名前で直接追加する候補も提供
      const customOption = {
        isRealGoogle: false,
        isCustom: true,
        place_id: `custom-${slugify(val)}`,
        name: `「${val}」をこのまま場所として登録`,
        secondary: '住所や位置情報は東京駅周辺を仮設定します（後で編集できます）'
      };

      setPredictions([...filteredPresets, customOption]);
      setIsSearching(false);
    }
  };

  const handleKeywordChange = (val) => {
    setSearchKeyword(val);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    if (!val.trim()) {
      setPredictions([]);
      setIsSearching(false);
      return;
    }

    // IME変換中は確定まで検索を送らない（変換中の断片でAPIを呼ばない）
    if (isComposingRef.current) return;

    setIsSearching(true);
    debounceTimerRef.current = setTimeout(() => runSearch(val), 350);
  };

  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = (e) => {
    isComposingRef.current = false;
    handleKeywordChange(e.target.value);
  };

  const handleSelectPrediction = (item) => {
    if (item.isRealGoogle && placesServiceRef.current) {
      placesServiceRef.current.getDetails(
        {
          placeId: item.place_id,
          fields: ['place_id', 'name', 'formatted_address', 'geometry', 'url', 'types', 'address_components']
        },
        (placeResult, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && placeResult) {
            let country = '';
            let adminArea = '';
            let locality = '';

            placeResult.address_components?.forEach(c => {
              if (c.types.includes('country')) country = c.long_name;
              if (c.types.includes('administrative_area_level_1')) adminArea = c.long_name;
              if (c.types.includes('locality')) locality = c.long_name;
            });

            const autoCategory = detectCategoryFromTypes(placeResult.types);

            onSelectedPlaceChange({
              id: generateUUID(),
              googlePlaceId: placeResult.place_id,
              name: placeResult.name,
              address: placeResult.formatted_address || '',
              lat: placeResult.geometry?.location?.lat() || 35.6812,
              lng: placeResult.geometry?.location?.lng() || 139.7671,
              googleMapsUrl: placeResult.url || `https://www.google.com/maps/place/?q=place_id:${placeResult.place_id}`,
              category: autoCategory,
              country: country || '日本',
              administrativeArea: adminArea,
              locality: locality
            });
            setPredictions([]);
            setSearchKeyword('');
          }
        }
      );
    } else if (item.mockData) {
      // プリセット選択
      const p = item.mockData;
      onSelectedPlaceChange({
        id: generateUUID(),
        googlePlaceId: item.place_id,
        name: p.name,
        address: p.address,
        lat: p.lat,
        lng: p.lng,
        googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}`,
        category: p.cat,
        country: '日本',
        administrativeArea: '東京都',
        locality: ''
      });
      setPredictions([]);
      setSearchKeyword('');
    } else {
      // 入力文字列でそのまま作成
      onSelectedPlaceChange({
        id: generateUUID(),
        googlePlaceId: item.place_id,
        name: searchKeyword.trim(),
        address: '指定地点',
        lat: 35.6812 + (Math.random() - 0.5) * 0.05,
        lng: 139.7671 + (Math.random() - 0.5) * 0.05,
        googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchKeyword.trim())}`,
        category: category || 'other',
        country: '日本',
        administrativeArea: '東京都',
        locality: ''
      });
      setPredictions([]);
      setSearchKeyword('');
    }
  };

  return (
    <div className="bg-sky-50/70 p-3.5 rounded-2xl border border-sky-200 space-y-2">
      <div ref={dummyDivRef} style={{ display: 'none' }} />

      {/* 場所が既に確定している場合は検索欄をロックして誤操作を防ぐ */}
      {isLocked && selectedPlace ? (
        <>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
              {lockedLabel}
            </span>
            <button
              type="button"
              onClick={() => onUnlock?.()}
              className="text-[10px] text-sky-700 underline font-semibold"
            >
              別の場所に変更する
            </button>
          </div>
          <div className="bg-white p-3 rounded-xl border border-sky-200 space-y-1">
            <div className="text-xs font-bold text-neutral-900">{selectedPlace.name}</div>
            <div className="text-[11px] text-neutral-500">{selectedPlace.address}</div>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <label className="block text-xs font-black text-sky-950 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-sky-600" />
              <span>お店・場所を検索</span>
              <span className="text-[10px] bg-sky-500 text-white px-1.5 py-0.2 rounded font-bold">必須</span>
            </label>
            {!isMapsLoaded && (
              <button
                type="button"
                onClick={onOpenApiKeyModal}
                className="text-[10px] text-amber-700 underline font-semibold"
              >
                APIキー設定
              </button>
            )}
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="店名、カフェ、駅名、ホテル名を入力..."
              value={searchKeyword}
              onChange={(e) => handleKeywordChange(e.target.value)}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              className="w-full bg-white border border-sky-200 rounded-xl px-3 py-2 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-sky-400 shadow-sm"
            />

            {isSearching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-sky-500">
                検索中...
              </span>
            )}

            {/* 検索サジェストリスト */}
            {predictions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-neutral-200 max-h-48 overflow-y-auto z-50 divide-y divide-neutral-100">
                {predictions.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectPrediction(p)}
                    className="w-full text-left px-3 py-2.5 hover:bg-sky-50 transition-colors text-xs flex flex-col"
                  >
                    <span className="font-bold text-neutral-800">{p.name}</span>
                    {p.secondary && (
                      <span className="text-[10px] text-neutral-400 truncate">{p.secondary}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 選択された場所のプレビューカード */}
          {selectedPlace && (
            <div className="bg-white p-3 rounded-xl border border-sky-200 space-y-1 mt-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded">
                  選択中の場所
                </span>
                {selectedPlace.googleMapsUrl && (
                  <a
                    href={selectedPlace.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-sky-600 hover:underline flex items-center gap-0.5"
                  >
                    <span>Googleマップで確認</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
              <div className="text-xs font-bold text-neutral-900">{selectedPlace.name}</div>
              <div className="text-[11px] text-neutral-500">{selectedPlace.address}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ==========================================
// 記録モーダル（Places API 検索 ＋ フォールバック対応）
// ==========================================
function RecordFormModal({ isOpen, onClose, initialVisit, initialPlace, places, isMapsLoaded, onOpenApiKeyModal, onToast, onSave }) {
  const [date, setDate] = useState(initialVisit?.date || getTodayDateString());
  const [rating, setRating] = useState(initialVisit?.rating || 5);
  const [note, setNote] = useState(initialVisit?.note || '');
  const [category, setCategory] = useState(initialPlace?.category || 'food');
  const [selectedPlace, setSelectedPlace] = useState(initialPlace || null);
  const [photos, setPhotos] = useState(initialVisit?.photos || []);
  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false);
  const photoInputRef = useRef(null);

  const MAX_PHOTOS = 5;

  // 場所が既に確定している（編集 / 再訪記録）場合は、誤って別の場所に
  // 差し替わらないよう検索欄をロックする。ロックを外すのは明示操作のみ。
  const isKnownExistingPlace = !!(initialPlace && places.some(p => p.id === initialPlace.id));
  const [isPlaceLocked, setIsPlaceLocked] = useState(isKnownExistingPlace);

  const handlePhotoFilesSelected = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // 同じファイルを選び直せるようにリセット
    if (files.length === 0) return;

    const remainingSlots = MAX_PHOTOS - photos.length;
    if (remainingSlots <= 0) {
      onToast?.(`写真は最大${MAX_PHOTOS}枚までです。`);
      return;
    }

    setIsProcessingPhotos(true);
    try {
      const compressed = await Promise.all(
        files.slice(0, remainingSlots).map(f => compressImageFile(f))
      );
      setPhotos(prev => [...prev, ...compressed]);
      if (files.length > remainingSlots) {
        onToast?.(`写真は最大${MAX_PHOTOS}枚までのため、一部のみ追加しました。`);
      }
    } catch (err) {
      console.warn('Photo compression failed:', err);
      onToast?.('写真の読み込みに失敗しました。');
    } finally {
      setIsProcessingPhotos(false);
    }
  };

  const handleRemovePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedPlace) {
      onToast?.('場所・お店を検索して選択してください。');
      return;
    }

    onSave({
      placeData: {
        ...selectedPlace,
        category
      },
      visitData: {
        date,
        rating: Number(rating),
        note: note.trim(),
        photos
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* モーダルヘッダー */}
        <div className="px-5 py-3.5 border-b border-neutral-150 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-neutral-900">
              {initialVisit ? '訪問記録の編集' : '行った場所を記録'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-neutral-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">

          <PlaceSearchField
            isMapsLoaded={isMapsLoaded}
            onOpenApiKeyModal={onOpenApiKeyModal}
            category={category}
            selectedPlace={selectedPlace}
            onSelectedPlaceChange={(place) => {
              setSelectedPlace(place);
              setCategory(place.category);
            }}
            isLocked={isPlaceLocked}
            onUnlock={() => setIsPlaceLocked(false)}
          />

          {/* 訪問日 */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-sky-500" />
              <span>訪問日</span>
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-800 focus:outline-none focus:border-sky-400"
            />
          </div>

          {/* カテゴリー＆評価 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">カテゴリー</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-2.5 py-2 text-xs text-neutral-800 focus:outline-none"
              >
                {Object.entries(CATEGORIES).map(([k, cat]) => (
                  <option key={k} value={k}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">評価</label>
              <select
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-2.5 py-2 text-xs text-neutral-800 focus:outline-none"
              >
                <option value={5}>⭐⭐⭐⭐⭐ (5点)</option>
                <option value={4}>⭐⭐⭐⭐ (4点)</option>
                <option value={3}>⭐⭐⭐ (3点)</option>
                <option value={2}>⭐⭐ (2点)</option>
                <option value={1}>⭐ (1点)</option>
              </select>
            </div>
          </div>

          {/* メモ */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              訪問時のメモ・感想
            </label>
            <textarea
              rows={3}
              placeholder="おすすめの料理、店内の雰囲気、混雑具合など..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-800 focus:outline-none focus:border-sky-400"
            />
          </div>

          {/* 写真（思い出ログとして、控えめなサムネイル表示） */}
          <div>
            <label className="flex items-center justify-between text-xs font-bold text-neutral-700 mb-1.5">
              <span>写真</span>
              <span className="text-[10px] text-neutral-400 font-normal">{photos.length}/{MAX_PHOTOS}枚</span>
            </label>
            <div className="flex gap-2 flex-wrap">
              {photos.map((src, idx) => (
                <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-neutral-200 bg-neutral-100">
                  <img src={src} alt={`写真${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(idx)}
                    className="absolute top-0.5 right-0.5 bg-black/55 text-white rounded-full w-4 h-4 flex items-center justify-center"
                    title="この写真を削除"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={isProcessingPhotos}
                  className="w-16 h-16 rounded-xl border border-dashed border-neutral-300 flex flex-col items-center justify-center text-neutral-400 hover:border-sky-400 hover:text-sky-500 transition-colors disabled:opacity-60"
                >
                  {isProcessingPhotos ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                  <span className="text-[9px] mt-0.5">追加</span>
                </button>
              )}
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoFilesSelected}
              className="hidden"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold py-3 rounded-2xl shadow-md transition-all active:scale-[0.98] text-xs"
            >
              {initialVisit ? '記録を更新する' : 'この内容で記録する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 行きたい場所モーダル（訪問前のウィッシュリスト登録）
// ==========================================
function WishlistFormModal({ onClose, isMapsLoaded, onOpenApiKeyModal, onToast, onSave }) {
  const [category, setCategory] = useState('food');
  const [memo, setMemo] = useState('');
  const [selectedPlace, setSelectedPlace] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedPlace) {
      onToast?.('場所・お店を検索して選択してください。');
      return;
    }

    onSave({
      ...selectedPlace,
      category,
      memo: memo.trim(),
      addedAt: getTodayDateString()
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-neutral-150 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Bookmark className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-neutral-900">行きたい場所を追加</h3>
          </div>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-neutral-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          <PlaceSearchField
            isMapsLoaded={isMapsLoaded}
            onOpenApiKeyModal={onOpenApiKeyModal}
            category={category}
            selectedPlace={selectedPlace}
            onSelectedPlaceChange={(place) => {
              setSelectedPlace(place);
              setCategory(place.category);
            }}
            isLocked={false}
          />

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">カテゴリー</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-2.5 py-2 text-xs text-neutral-800 focus:outline-none"
            >
              {Object.entries(CATEGORIES).map(([k, cat]) => (
                <option key={k} value={k}>{cat.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              メモ（気になる理由・行きたい時期など）
            </label>
            <textarea
              rows={3}
              placeholder="友達がおすすめしてた、期間限定メニューが気になる、など..."
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-800 focus:outline-none focus:border-sky-400"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold py-3 rounded-2xl shadow-md transition-all active:scale-[0.98] text-xs"
            >
              行きたいリストに追加する
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 場所詳細モーダル
// ==========================================
function PlaceDetailModal({ place, onClose, onJumpToMap, onAddVisit, onDeletePlace }) {
  const [lightboxSrc, setLightboxSrc] = useState(null);

  if (!place) return null;
  const cat = CATEGORIES[place.category] || CATEGORIES.other;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-neutral-150 flex items-center justify-between">
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${cat.bg} ${cat.text} ${cat.border}`}>
            <cat.icon className="w-3 h-3" />
            {cat.label}
          </span>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-neutral-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          <div>
            <h3 className="text-lg font-black text-neutral-900 leading-tight">{place.name}</h3>
            <p className="text-xs text-neutral-500 mt-1">{place.address}</p>
          </div>

          <div className="flex gap-2">
            {place.googleMapsUrl && (
              <a
                href={place.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Googleマップで開く</span>
              </a>
            )}
            <button
              onClick={onJumpToMap}
              className="flex-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>マップで見る</span>
            </button>
          </div>

          <div>
            <div className="text-xs font-bold text-neutral-700 mb-2 flex items-center justify-between">
              <span>訪問記録 ({place.visits?.length || 0}回)</span>
              <button
                onClick={onAddVisit}
                className="text-sky-600 hover:text-sky-700 text-[11px] font-bold"
              >
                ＋ 再訪を記録
              </button>
            </div>

            <div className="space-y-2">
              {place.visits?.map((v) => (
                <div key={v.id} className="bg-neutral-50 p-3 rounded-xl border border-neutral-150">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-neutral-800">
                      {formatDateWithWeekday(v.date)}
                    </span>
                    <span className="text-amber-400">{'★'.repeat(v.rating || 5)}</span>
                  </div>
                  {v.note && (
                    <p className="text-xs text-neutral-600 mt-1.5 leading-relaxed">
                      {v.note}
                    </p>
                  )}
                  {v.photos && v.photos.length > 0 && (
                    <div className="flex gap-1.5 mt-2 overflow-x-auto snap-x snap-mandatory pb-0.5">
                      {v.photos.map((src, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setLightboxSrc(src)}
                          className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-neutral-200 snap-center"
                        >
                          <img src={src} alt={`${formatDateWithWeekday(v.date)}の写真${idx + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-neutral-150">
            <button
              onClick={onDeletePlace}
              className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>この場所と全記録を削除</span>
            </button>
          </div>
        </div>
      </div>

      {/* 写真の拡大表示（ライトボックス） */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-6"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            onClick={() => setLightboxSrc(null)}
            className="absolute top-4 right-4 text-white/90 hover:text-white p-2"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxSrc}
            alt=""
            className="max-w-full max-h-full rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// ==========================================
// マップ表示コンポーネント（Google Maps ＆ プレビューフォールバック）
// ==========================================
function MapViewerComponent({ isLoaded, apiKey, places, wishlist, targetPlace, onSelectPlace, onConvertWishlistToVisit, onRequestAddSpot, onOpenApiKeyModal, onToast }) {
  const mapRef = useRef(null);
  const googleMapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const infoWindowRef = useRef(null);

  const [mapViewMode, setMapViewMode] = useState('visited'); // 'visited' | 'wishlist'
  const [mapCategory, setMapCategory] = useState('all');
  const [mapSearch, setMapSearch] = useState('');
  const [isLocating, setIsLocating] = useState(false);

  // 「行った」／「行きたい」のどちらを地図に表示するか
  const sourceList = useMemo(
    () => (mapViewMode === 'wishlist' ? wishlist : places),
    [mapViewMode, wishlist, places]
  );

  // Google Maps 初期化
  useEffect(() => {
    if (!isLoaded || !mapRef.current || !window.google?.maps) return;

    if (!googleMapInstanceRef.current) {
      try {
        const map = new window.google.maps.Map(mapRef.current, {
          center: { lat: 35.6812, lng: 139.7671 },
          zoom: 12,
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false
        });

        infoWindowRef.current = new window.google.maps.InfoWindow();

        map.addListener('click', (e) => {
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          onRequestAddSpot(lat, lng, '地図からの選択地点');
        });

        googleMapInstanceRef.current = map;
      } catch (err) {
        console.warn('Google Maps Init Error:', err);
      }
    }

    return () => {
      if (googleMapInstanceRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(googleMapInstanceRef.current);
      }
    };
  }, [isLoaded]);

  // マーカー更新
  useEffect(() => {
    if (!googleMapInstanceRef.current || !window.google?.maps) return;
    const map = googleMapInstanceRef.current;

    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    let filtered = sourceList.filter(p => p.lat && p.lng);
    if (mapCategory !== 'all') {
      filtered = filtered.filter(p => p.category === mapCategory);
    }
    if (mapSearch.trim()) {
      const q = mapSearch.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || (p.address && p.address.toLowerCase().includes(q)));
    }

    const bounds = new window.google.maps.LatLngBounds();

    filtered.forEach(place => {
      const cat = CATEGORIES[place.category] || CATEGORIES.other;
      const position = { lat: place.lat, lng: place.lng };

      const marker = new window.google.maps.Marker({
        position,
        map,
        title: place.name,
        icon: buildEmojiMarkerIcon(cat.emoji, cat.color, mapViewMode === 'wishlist')
      });

      marker.addListener('click', () => {
        const contentDiv = document.createElement('div');
        contentDiv.style.padding = '4px';
        contentDiv.style.maxWidth = '200px';

        const title = document.createElement('div');
        title.style.fontWeight = 'bold';
        title.style.fontSize = '13px';
        title.textContent = `${cat.emoji} ${place.name}`;
        contentDiv.appendChild(title);

        const sub = document.createElement('div');
        sub.style.fontSize = '11px';
        sub.style.color = '#0284c7';
        sub.style.marginTop = '2px';
        sub.textContent = mapViewMode === 'wishlist'
          ? '行きたい場所として保存済み'
          : `最終訪問: ${place.lastVisited ? formatDateWithWeekday(place.lastVisited) : '未訪問'}`;
        contentDiv.appendChild(sub);

        const btn = document.createElement('button');
        btn.innerText = mapViewMode === 'wishlist' ? '訪問を記録' : '詳細を見る';
        btn.style.marginTop = '6px';
        btn.style.width = '100%';
        btn.style.padding = '4px';
        btn.style.backgroundColor = '#0284c7';
        btn.style.color = '#fff';
        btn.style.fontSize = '11px';
        btn.style.border = 'none';
        btn.style.borderRadius = '4px';
        btn.style.cursor = 'pointer';
        btn.onclick = () => (mapViewMode === 'wishlist' ? onConvertWishlistToVisit?.(place) : onSelectPlace(place));
        contentDiv.appendChild(btn);

        infoWindowRef.current.setContent(contentDiv);
        infoWindowRef.current.open(map, marker);
      });

      markersRef.current.push(marker);
      bounds.extend(position);
    });

    if (filtered.length > 0 && !targetPlace) {
      map.fitBounds(bounds, { top: 50, bottom: 50, left: 30, right: 30 });
      if (filtered.length === 1) map.setZoom(15);
    }
  }, [sourceList, mapViewMode, mapCategory, mapSearch, targetPlace, isLoaded, onSelectPlace, onConvertWishlistToVisit]);

  // targetPlace 移動
  useEffect(() => {
    if (targetPlace && googleMapInstanceRef.current && targetPlace.lat && targetPlace.lng) {
      googleMapInstanceRef.current.panTo({ lat: targetPlace.lat, lng: targetPlace.lng });
      googleMapInstanceRef.current.setZoom(16);
    }
  }, [targetPlace]);

  // 現在地取得
  const handleLocate = () => {
    if (!navigator.geolocation) {
      onToast?.('現在地取得に対応していません。');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        if (googleMapInstanceRef.current) {
          googleMapInstanceRef.current.panTo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          googleMapInstanceRef.current.setZoom(15);
        }
      },
      () => {
        setIsLocating(false);
        onToast?.('現在地を取得できませんでした。位置情報の許可をご確認ください。');
      },
      { timeout: 8000 }
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-135px)] lg:h-[calc(100vh-160px)] relative rounded-2xl overflow-hidden border border-neutral-200 shadow-sm">

      {/* 検索・カテゴリー */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-col gap-2 pointer-events-none">
        {/* 行った／行きたい 切り替え */}
        <div className="pointer-events-auto flex justify-center">
          <div className="flex items-center gap-1 bg-white/95 backdrop-blur-md rounded-full p-1 shadow-md border border-neutral-200 text-xs">
            <button
              onClick={() => setMapViewMode('visited')}
              className={`flex items-center gap-1 px-3 py-1 rounded-full font-bold transition-colors ${
                mapViewMode === 'visited' ? 'bg-sky-600 text-white' : 'text-neutral-500'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>行った ({places.length})</span>
            </button>
            <button
              onClick={() => setMapViewMode('wishlist')}
              className={`flex items-center gap-1 px-3 py-1 rounded-full font-bold transition-colors ${
                mapViewMode === 'wishlist' ? 'bg-sky-600 text-white' : 'text-neutral-500'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>行きたい ({wishlist.length})</span>
            </button>
          </div>
        </div>

        <div className="pointer-events-auto bg-white/95 backdrop-blur-md rounded-xl shadow-md border border-neutral-200 flex items-center px-3 py-1.5">
          <Search className="w-3.5 h-3.5 text-neutral-400 mr-2" />
          <input
            type="text"
            placeholder="マップ上の場所を検索..."
            value={mapSearch}
            onChange={(e) => setMapSearch(e.target.value)}
            className="w-full bg-transparent text-xs text-neutral-800 focus:outline-none"
          />
          {mapSearch && (
            <button onClick={() => setMapSearch('')} className="text-neutral-400">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex gap-1 overflow-x-auto pb-1 text-xs pointer-events-auto">
          <button
            onClick={() => setMapCategory('all')}
            className={`px-3 py-1 rounded-full text-[10px] font-bold shadow-md backdrop-blur-md transition-all whitespace-nowrap ${
              mapCategory === 'all' ? 'bg-neutral-900 text-white' : 'bg-white/90 text-neutral-700'
            }`}
          >
            すべて ({sourceList.length})
          </button>
          {Object.entries(CATEGORIES).map(([k, cat]) => (
            <button
              key={k}
              onClick={() => setMapCategory(k)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold shadow-md backdrop-blur-md transition-all whitespace-nowrap flex items-center gap-1 ${
                mapCategory === k ? 'bg-sky-600 text-white' : 'bg-white/90 text-neutral-700'
              }`}
            >
              <cat.icon className="w-3 h-3" />
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 現在地ボタン */}
      {isLoaded && (
        <button
          onClick={handleLocate}
          className="absolute bottom-4 right-4 z-20 w-10 h-10 rounded-xl bg-white shadow-lg border border-neutral-200 flex items-center justify-center text-neutral-700 hover:bg-neutral-50 active:scale-95 transition-all"
        >
          <Navigation className={`w-4 h-4 ${isLocating ? 'animate-spin text-sky-500' : 'text-neutral-700'}`} />
        </button>
      )}

      {/* Googleマップ描画DOM */}
      <div ref={mapRef} className="w-full h-full z-0 bg-neutral-100" />

      {/* APIキー未設定時でもアプリが壊れない安全なプレビューカード表示 */}
      {!isLoaded && (
        <div className="absolute inset-0 z-10 bg-neutral-50/95 flex flex-col p-4 overflow-y-auto">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center mb-3">
            <h4 className="text-xs font-bold text-amber-900 mb-1">Google Maps APIキーが未設定です</h4>
            <p className="text-[11px] text-amber-700 mb-2">
              キーを入力するとインタラクティブなピン地図がここに表示されます。
            </p>
            <button
              onClick={onOpenApiKeyModal}
              className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold px-3 py-1 rounded-lg"
            >
              APIキーを入力する
            </button>
          </div>

          {/* 行った／行きたい 切り替え（フォールバック時も利用可能） */}
          <div className="flex items-center gap-1 bg-white rounded-full p-1 border border-neutral-200 text-xs w-fit mb-3">
            <button
              onClick={() => setMapViewMode('visited')}
              className={`flex items-center gap-1 px-3 py-1 rounded-full font-bold transition-colors ${
                mapViewMode === 'visited' ? 'bg-sky-600 text-white' : 'text-neutral-500'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>行った ({places.length})</span>
            </button>
            <button
              onClick={() => setMapViewMode('wishlist')}
              className={`flex items-center gap-1 px-3 py-1 rounded-full font-bold transition-colors ${
                mapViewMode === 'wishlist' ? 'bg-sky-600 text-white' : 'text-neutral-500'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>行きたい ({wishlist.length})</span>
            </button>
          </div>

          <div className="text-xs font-bold text-neutral-600 mb-2">
            {mapViewMode === 'wishlist' ? '行きたい場所一覧' : '登録済みスポット一覧'} ({sourceList.length}件):
          </div>

          <div className="space-y-2 flex-1">
            {sourceList.map(p => {
              const cat = CATEGORIES[p.category] || CATEGORIES.other;
              return (
                <div
                  key={p.id}
                  onClick={() => (mapViewMode === 'wishlist' ? onConvertWishlistToVisit?.(p) : onSelectPlace(p))}
                  className="bg-white p-3 rounded-xl border border-neutral-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-sky-300"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1 rounded ${cat.bg} ${cat.text}`}>
                        <cat.icon className="w-2.5 h-2.5" />
                        {cat.label}
                      </span>
                      <span className="text-xs font-bold text-neutral-800">{p.name}</span>
                    </div>
                    <div className="text-[10px] text-neutral-400 mt-0.5">{p.address}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-400" />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

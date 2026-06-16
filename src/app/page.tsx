export default function Home() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">給与計算Webアプリ</h1>
        <p className="text-gray-500 mb-8">スタッフ情報・給与管理システム</p>
        <div className="flex gap-4 justify-center">
          <a
            href="/dashboard"
            className="px-6 py-3 bg-[#34675C] text-white rounded-lg hover:bg-[#2a5249] transition-colors"
          >
            アプリを開く
          </a>
          <a
            href="/api/sheets/test"
            target="_blank"
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            API接続テスト
          </a>
        </div>
      </div>
    </div>
  );
}

package com.sgshs.pilot.comparecountry

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    // 뒤로가기: WebView 안에 돌아갈 기록이 있을 때만 켜서 goBack()에 쓰고, 없으면 꺼 둬서 시스템 기본
    // 동작(앱 나가기, predictive back 미리보기 포함)에 맡긴다. 켜고 끄는 것은 doUpdateVisitedHistory에서 한다.
    private val webBackCallback = object : OnBackPressedCallback(false) {
        override fun handleOnBackPressed() {
            webView.goBack()
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        applySystemBarInsets()

        webView = findViewById(R.id.webView)

        // 로컬 assets/www 폴더의 파일들을 안전한 가상 도메인으로 매핑 (CORS 및 로컬 파일 보안 이슈 완벽 해결)
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView.webViewClient = object : WebViewClientCompat() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? {
                return assetLoader.shouldInterceptRequest(request.url)
            }

            // 앱 자산 도메인 밖으로 나가는 링크(OSM 저작자 표기 등)는 앱 WebView가 아니라 기본 브라우저로
            // 연다. WebView 안에서 열면 앱으로 돌아올 때 페이지가 다시 로드되어 비교 상태가 초기화된다.
            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                val url = request.url
                if (!request.isForMainFrame || url.host == WebViewAssetLoader.DEFAULT_DOMAIN) {
                    return false
                }
                if (url.scheme == "https" || url.scheme == "http") {
                    openInBrowser(url)
                }
                return true
            }

            override fun doUpdateVisitedHistory(view: WebView, url: String?, isReload: Boolean) {
                webBackCallback.isEnabled = view.canGoBack()
            }
        }

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            cacheMode = WebSettings.LOAD_DEFAULT
            useWideViewPort = true
            loadWithOverviewMode = true
            // R-2: OSM 공식 타일서버를 직접 호출하므로 OSM 사용 정책(Tile Usage Policy)에
            // 따라 앱을 식별할 수 있는 User-Agent를 붙인다. JS의 fetch/XHR는 User-Agent가
            // forbidden header라 자바스크립트에서 설정할 수 없어, WebView 설정이 유일한 경로다.
            // 버전은 build.gradle.kts의 versionName을 그대로 쓴다(따로 고칠 곳이 없도록).
            userAgentString = "${WebSettings.getDefaultUserAgent(this@MainActivity)} DaehanmingukBaroalgi/${BuildConfig.VERSION_NAME} (+https://github.com/genishs/compare-country-area)"
        }

        // 안드로이드 뒤로가기 버튼 처리
        onBackPressedDispatcher.addCallback(this, webBackCallback)

        // 로컬 빌드된 OpenLayers 웹 앱 로드
        webView.loadUrl("https://${WebViewAssetLoader.DEFAULT_DOMAIN}/assets/www/index.html")
    }

    private fun openInBrowser(uri: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE))
        } catch (e: ActivityNotFoundException) {
            Toast.makeText(this, R.string.no_app_to_open_link, Toast.LENGTH_SHORT).show()
        }
    }

    /**
     * targetSdk 35 이상 앱은 Android 15+에서 edge-to-edge가 강제되어 화면이 상태바·내비게이션 바·
     * 디스플레이 컷아웃 밑까지 그려진다. 그 크기만큼 루트에 padding을 줘서 WebView(제목 카드·검색창·
     * 비교 카드·OSM 저작자 표기)가 시스템 바에 가리지 않게 한다. 바 뒤로는 루트 배경색이 보인다.
     * API 34 이하는 시스템이 이미 바 영역을 빼고 배치하므로 인셋이 0으로 와서 달라지는 것이 없다.
     */
    private fun applySystemBarInsets() {
        val root = findViewById<View>(R.id.root)
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }

        // 바 뒤 배경(루트, #f8fafc)이 밝으므로 상태바·내비게이션 바 아이콘을 어둡게 한다.
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = true
            isAppearanceLightNavigationBars = true
        }
    }
}

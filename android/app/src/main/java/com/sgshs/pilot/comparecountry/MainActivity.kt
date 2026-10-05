package com.sgshs.pilot.comparecountry

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var lastInsetsJs: String? = null

    // 뒤로가기: WebView 안에 돌아갈 기록이 있을 때만 켜서 goBack()에 쓰고, 없으면 꺼 둬서 시스템 기본
    // 동작(앱 나가기, predictive back 미리보기 포함)에 맡긴다. 켜고 끄는 것은 doUpdateVisitedHistory에서 한다.
    private val webBackCallback = object : OnBackPressedCallback(false) {
        override fun handleOnBackPressed() {
            webView.goBack()
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        // #2: Android 15+(API 35+) 및 이전 버전(API 21+) 모두에서 공식 권장 Edge-to-Edge 활성화
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        applySystemBarInsets()

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

            override fun onPageFinished(view: WebView, url: String?) {
                super.onPageFinished(view, url)
                // 페이지 로드 완료 시 최신 시스템 바/노치 인셋을 CSS 변수로 즉시 주입
                lastInsetsJs?.let { js ->
                    view.evaluateJavascript(js, null)
                }
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
            // #8: 시스템 글꼴 크기 설정(fontScale)을 적정 범위(85%~130%) 내에서 반영하여 가독성 및 접근성 향상
            val fontScale = resources.configuration.fontScale
            textZoom = (fontScale * 100).toInt().coerceIn(85, 130)
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
     * #2: 몰입형 Edge-to-Edge 구현
     * 지도는 상태바·내비게이션 바·디스플레이 컷아웃(노치/펀치홀) 뒤까지 100% 꽉 채우고,
     * 시스템 인셋(left, top, right, bottom)을 CSS 변수(--safe-area-*)로 웹에 실시간 주입하여
     * 상단 헤더, 검색창, 줌 버튼, 하단 바텀시트, OSM 저작자 표기가 가리지 않도록 배치한다.
     */
    private fun applySystemBarInsets() {
        val root = findViewById<View>(R.id.root)
        // 루트 뷰 패딩은 0으로 유지하여 WebView 지도가 화면 전체를 채우도록 함
        root.setPadding(0, 0, 0, 0)

        ViewCompat.setOnApplyWindowInsetsListener(root) { _, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )
            val density = resources.displayMetrics.density
            val topDp = (bars.top / density).toInt()
            val bottomDp = (bars.bottom / density).toInt()
            val leftDp = (bars.left / density).toInt()
            val rightDp = (bars.right / density).toInt()

            updateWebSafeInsets(topDp, bottomDp, leftDp, rightDp)
            insets
        }

        // 바 뒤에 밝은 OSM 지도 타일이 채워지므로 상태바·내비게이션 바 아이콘을 어둡게 설정
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = true
            isAppearanceLightNavigationBars = true
        }
    }

    private fun updateWebSafeInsets(top: Int, bottom: Int, left: Int, right: Int) {
        val js = """
            (function() {
                var el = document.documentElement;
                if (!el) return;
                el.style.setProperty('--safe-area-top', '${top}px');
                el.style.setProperty('--safe-area-bottom', '${bottom}px');
                el.style.setProperty('--safe-area-left', '${left}px');
                el.style.setProperty('--safe-area-right', '${right}px');
            })();
        """.trimIndent()
        lastInsetsJs = js
        if (::webView.isInitialized) {
            webView.evaluateJavascript(js, null)
        }
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        if (::webView.isInitialized) {
            val fontScale = newConfig.fontScale
            webView.settings.textZoom = (fontScale * 100).toInt().coerceIn(85, 130)
        }
    }
}

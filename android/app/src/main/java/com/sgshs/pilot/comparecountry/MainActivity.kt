package com.sgshs.pilot.comparecountry

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

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
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })

        // 로컬 빌드된 OpenLayers 웹 앱 로드
        webView.loadUrl("https://appassets.androidplatform.net/assets/www/index.html")
    }
}

package app.chatflow

import android.app.Activity
import android.os.Bundle
import android.content.Intent
import android.net.Uri
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.ValueCallback
import android.view.WindowManager
import android.graphics.Color

class MainActivity : Activity() {
    private lateinit var web: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private val filePickerRequest = 1001

    @Suppress("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.statusBarColor = Color.rgb(10, 12, 18)
        window.navigationBarColor = Color.rgb(10, 12, 18)
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS or WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION)
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
        window.decorView.systemUiVisibility = 0
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)

        web = WebView(this)
        web.setBackgroundColor(Color.rgb(10, 12, 18))
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.settings.allowFileAccess = true
        web.settings.allowContentAccess = true
        web.settings.setSupportZoom(false)

        // Let Android fit the WebView between the system bars.
        // Do not add a second set of status/navigation bar insets here.

        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback

                val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "text/plain"
                    putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("text/plain", "application/octet-stream"))
                }
                return try {
                    startActivityForResult(Intent.createChooser(intent, "Select chat export"), filePickerRequest)
                    true
                } catch (e: Exception) {
                    this@MainActivity.filePathCallback?.onReceiveValue(null)
                    this@MainActivity.filePathCallback = null
                    false
                }
            }
        }
        web.webViewClient = WebViewClient()
        setContentView(web)
        web.loadUrl("file:///android_asset/index.html")
    }

    @Deprecated("Deprecated in Android")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == filePickerRequest) {
            val result = if (resultCode == RESULT_OK && data?.data != null) arrayOf(data.data!!) else null
            filePathCallback?.onReceiveValue(result)
            filePathCallback = null
        }
    }

    @Deprecated("Deprecated in Android")
    override fun onBackPressed() {
        if (::web.isInitialized && web.canGoBack()) web.goBack() else super.onBackPressed()
    }
}

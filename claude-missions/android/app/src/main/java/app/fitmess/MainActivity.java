package app.fitmess;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /**
     * The hardware back button walks the web view's history instead of killing
     * the app.
     *
     * Capacitor ships no back handling of its own, so the Android default
     * applies: one press anywhere in the app finishes the activity. That is
     * wrong twice over. It breaks the plainest expectation an Android user
     * has -- back means "the screen before" -- and it collides with the rule
     * this product is built on: from inside FitMess there is no exit, because
     * an app with no way back is an app the user has to kill.
     *
     * Next.js client navigation is pushState, which the web view records as
     * real history entries, so this covers moving between tabs and into the
     * logging flows alike.
     *
     * At the first screen there is nothing to go back to, and there the
     * default is right: back leaves the app, exactly as it does from the root
     * of any other Android app.
     *
     * Deprecated in favour of the predictive-back callback, and kept
     * deliberately: `android:enableOnBackInvokedCallback` is not set in the
     * manifest, so this is still the path the system calls.
     */
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (this.bridge != null
                && this.bridge.getWebView() != null
                && this.bridge.getWebView().canGoBack()) {
            this.bridge.getWebView().goBack();
            return;
        }
        super.onBackPressed();
    }
}

package app.nihongo.academy;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;

/**
 * The app's own speech recogniser bridge. Unlike the community plugin it
 * always reports the FINAL words ("result"), every error ("error"), and the
 * live words while you speak ("partial"), so the app never waits forever.
 * Microphone permission is requested by the community plugin before start.
 */
@CapacitorPlugin(name = "NihongoStt")
public class SttPlugin extends Plugin {
    private SpeechRecognizer rec;
    private final Handler main = new Handler(Looper.getMainLooper());
    private int session = 0;

    @PluginMethod
    public void start(PluginCall call) {
        final String lang = call.getString("lang", "ja-JP");
        final int id = ++session;
        main.post(() -> {
            try {
                destroy();
                if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
                    call.reject("Speech recognition is not available on this phone. Install or enable the Google app.");
                    return;
                }
                rec = SpeechRecognizer.createSpeechRecognizer(getActivity());
                rec.setRecognitionListener(new Listener(id));
                Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang);
                i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, lang);
                i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5);
                i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
                i.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getActivity().getPackageName());
                // Give beginners time to think between words before it stops by itself.
                i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2000L);
                i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L);
                rec.startListening(i);
                call.resolve();
            } catch (Exception e) {
                call.reject("Could not start the microphone: " + e.getMessage());
            }
        });
    }

    /** Finish now and deliver what was heard (a "result" or "error" event follows). */
    @PluginMethod
    public void stop(PluginCall call) {
        main.post(() -> {
            try { if (rec != null) rec.stopListening(); } catch (Exception ignored) { }
            call.resolve();
        });
    }

    /** Throw away the current listening without a result. */
    @PluginMethod
    public void cancel(PluginCall call) {
        session++;
        main.post(() -> { destroy(); call.resolve(); });
    }

    private void destroy() {
        if (rec != null) {
            try { rec.cancel(); } catch (Exception ignored) { }
            try { rec.destroy(); } catch (Exception ignored) { }
            rec = null;
        }
    }

    @Override
    protected void handleOnPause() {
        session++;
        main.post(this::destroy);
        super.handleOnPause();
    }

    private class Listener implements RecognitionListener {
        private final int id;
        private boolean done = false;
        Listener(int id) { this.id = id; }
        private boolean live() { return id == session && !done; }

        private void send(String event, JSObject data) { if (live()) notifyListeners(event, data); }

        @Override public void onReadyForSpeech(Bundle params) { JSObject o = new JSObject(); o.put("status", "ready"); send("state", o); }
        @Override public void onBeginningOfSpeech() { JSObject o = new JSObject(); o.put("status", "speaking"); send("state", o); }
        @Override public void onRmsChanged(float rmsdB) { }
        @Override public void onBufferReceived(byte[] buffer) { }
        @Override public void onEndOfSpeech() { JSObject o = new JSObject(); o.put("status", "processing"); send("state", o); }
        @Override public void onEvent(int eventType, Bundle params) { }

        @Override
        public void onPartialResults(Bundle b) {
            ArrayList<String> m = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
            if (m == null || m.isEmpty() || m.get(0) == null || m.get(0).trim().isEmpty()) return;
            JSObject o = new JSObject();
            o.put("text", m.get(0));
            send("partial", o);
        }

        @Override
        public void onResults(Bundle b) {
            ArrayList<String> m = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
            JSObject o = new JSObject();
            o.put("matches", new JSArray(m == null ? new ArrayList<String>() : m));
            send("result", o);
            done = true;
        }

        @Override
        public void onError(int error) {
            JSObject o = new JSObject();
            o.put("code", error);
            o.put("message", text(error));
            send("error", o);
            done = true;
        }
    }

    private static String text(int code) {
        switch (code) {
            case SpeechRecognizer.ERROR_NO_MATCH: return "nomatch";
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT: return "silence";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: return "Microphone permission is off. Allow it in Android Settings → Apps → Nihongo → Permissions.";
            case SpeechRecognizer.ERROR_NETWORK:
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT: return "The phone's speech service needs internet (or the offline Japanese voice pack).";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY: return "busy";
            case SpeechRecognizer.ERROR_AUDIO: return "The microphone could not record. Is another app using it?";
            case SpeechRecognizer.ERROR_CLIENT: return "client";
            case SpeechRecognizer.ERROR_SERVER: return "The speech service had a problem. Try again.";
            case 12: return "Japanese is not installed for speech recognition. In the Google app: Settings → Voice → Languages → add 日本語.";
            case 13: return "Japanese is not available for speech recognition right now. Add 日本語 in Google app → Settings → Voice → Languages.";
            default: return "Speech recognition error (" + code + ").";
        }
    }
}

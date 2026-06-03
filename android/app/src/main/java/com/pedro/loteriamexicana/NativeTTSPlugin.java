package com.pedro.loteriamexicana;

import android.speech.tts.TextToSpeech;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Locale;

@CapacitorPlugin(name = "LoteriaAudio")
public class NativeTTSPlugin extends Plugin {
    private TextToSpeech tts;
    private boolean isTtsReady = false;

    @Override
    public void load() {
        super.load();
        Log.d("LOTERIA_DEBUG", "NativeTTSPlugin: load() llamado");
        try {
            tts = new TextToSpeech(getContext(), status -> {
                if (status == TextToSpeech.SUCCESS) {
                    Log.d("LOTERIA_DEBUG", "TTS: Éxito en inicialización");
                    int result = tts.setLanguage(new Locale("es", "MX"));
                    if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                        Log.e("LOTERIA_DEBUG", "TTS: Idioma es-MX no soportado, intentando es genérico");
                        tts.setLanguage(new Locale("es"));
                    }
                    isTtsReady = true;
                    Log.d("LOTERIA_DEBUG", "TTS: Motor Nativo listo y configurado");
                } else {
                    Log.e("LOTERIA_DEBUG", "TTS: Error al inicializar: " + status);
                }
            });
        } catch (Exception e) {
            Log.e("LOTERIA_DEBUG", "TTS: Excepción durante la creación: " + e.getMessage());
        }
    }

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text");
        if (isTtsReady && tts != null && text != null) {
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "msg_" + System.currentTimeMillis());
            call.resolve();
        } else {
            Log.e("LOTERIA_DEBUG", "TTS no listo. Ready: " + isTtsReady);
            call.reject("TTS Nativo no disponible, usando respaldo web");
        }
    }

    @PluginMethod
    public void ping(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("status", "OK");
        ret.put("ttsReady", isTtsReady);
        call.resolve(ret);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (tts != null) tts.stop();
        call.resolve();
    }
}

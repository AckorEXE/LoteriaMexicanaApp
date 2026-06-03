package com.pedro.loteriamexicana;

import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Registramos el plugin ANTES de super.onCreate para asegurar que Capacitor lo detecte al iniciar el puente
        registerPlugin(NativeTTSPlugin.class);
        super.onCreate(savedInstanceState);
        
        // Mantener la pantalla encendida siempre que la app esté en primer plano
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        Log.d("LOTERIA_DEBUG", "MainActivity onCreate ejecutado y plugin registrado");
    }
}

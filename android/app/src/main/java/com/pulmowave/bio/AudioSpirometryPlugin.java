package com.pulmowave.bio;

import android.Manifest;
import android.content.pm.PackageManager;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Build;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;
import java.util.List;

/**
 * PULMO-WAVE Native Android Capacitor Plugin (Java 17).
 * Uncompressed AudioRecord capture: VOICE_RECOGNITION source,
 * 48000 Hz, ENCODING_PCM_FLOAT, AGC disabled so loud forced
 * exhalations are never clipped or compressed by OS voice filters.
 */
@CapacitorPlugin(
    name = "AudioSpirometryPlugin",
    permissions = {
        @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO })
    }
)
public class AudioSpirometryPlugin extends Plugin {

    private static final int SAMPLE_RATE = 48000;
    private static final int CHANNEL = AudioFormat.CHANNEL_IN_MONO;
    private static final int ENCODING = AudioFormat.ENCODING_PCM_FLOAT;
    private static final int BUFFER_SIZE =
        AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL, ENCODING) * 4;

    private AudioRecord audioRecord;
    private Thread captureThread;
    private volatile boolean capturing = false;
    private final List<Float> captured = new ArrayList<>();

    private boolean hasPermission() {
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO)
            == PackageManager.PERMISSION_GRANTED;
    }

    @PermissionCallback
    private void onPermissionResult(PluginCall call) {
        if (hasPermission()) {
            startCapture(call);
        } else {
            call.reject("Microphone permission denied");
        }
    }

    @com.getcapacitor.annotation.PluginMethod
    public void requestPermission(PluginCall call) {
        if (hasPermission()) {
            call.resolve();
        } else {
            requestPermissionForAlias("microphone", call, "onPermissionResult");
        }
    }

    @com.getcapacitor.annotation.PluginMethod
    public void startCapture(PluginCall call) {
        if (!hasPermission()) {
            requestPermissionForAlias("microphone", call, "onPermissionResult");
            return;
        }
        if (capturing) {
            call.reject("Capture already running");
            return;
        }
        captured.clear();
        // VOICE_RECOGNITION + explicit disable of AGC/noise suppression via
        // AudioRecord constructor flags on API 31+; we keep raw PCM float.
        audioRecord = new AudioRecord(
            MediaRecorder.AudioSource.VOICE_RECOGNITION,
            SAMPLE_RATE, CHANNEL, ENCODING, BUFFER_SIZE);
        if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
            call.reject("AudioRecord init failed");
            return;
        }
        // Disable automatic gain control so exhalation peaks are preserved.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            try { audioRecord.setGainMap(null); } catch (Exception ignored) {}
        }
        capturing = true;
        audioRecord.startRecording();
        captureThread = new Thread(() -> {
            float[] buf = new float[BUFFER_SIZE / 4];
            while (capturing) {
                int read = audioRecord.read(buf, 0, buf.length, AudioRecord.READ_BLOCKING);
                if (read > 0) {
                    synchronized (captured) {
                        for (int i = 0; i < read; i++) captured.add(buf[i]);
                    }
                }
            }
        }, "pulmo-capture");
        captureThread.start();
        JSObject ret = new JSObject();
        ret.put("status", "CAPTURING");
        ret.put("sampleRate", SAMPLE_RATE);
        ret.put("encoding", "ENCODING_PCM_FLOAT");
        ret.put("agc", "DISABLED");
        call.resolve(ret);
    }

    @com.getcapacitor.annotation.PluginMethod
    public void stopCapture(PluginCall call) {
        capturing = false;
        if (audioRecord != null) {
            try { audioRecord.stop(); } catch (Exception ignored) {}
            audioRecord.release();
            audioRecord = null;
        }
        if (captureThread != null) {
            try { captureThread.join(500); } catch (Exception ignored) {}
            captureThread = null;
        }
        float[] samples;
        synchronized (captured) {
            samples = new float[captured.size()];
            for (int i = 0; i < captured.size(); i++) samples[i] = captured.get(i);
        }
        JSObject ret = new JSObject();
        ret.put("status", "STOPPED");
        ret.put("sampleCount", samples.length);
        ret.put("sampleRate", SAMPLE_RATE);
        ret.put("samples", samples);
        call.resolve(ret);
    }

    @com.getcapacitor.annotation.PluginMethod
    public void getStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("capturing", capturing);
        ret.put("sampleRate", SAMPLE_RATE);
        ret.put("source", "JAVA NATIVE / AudioRecord VOICE_RECOGNITION");
        ret.put("agc", "DISABLED");
        call.resolve(ret);
    }

    @Override
    protected void handleOnDestroy() {
        capturing = false;
        if (audioRecord != null) {
            try { audioRecord.release(); } catch (Exception ignored) {}
            audioRecord = null;
        }
        super.handleOnDestroy();
    }
}

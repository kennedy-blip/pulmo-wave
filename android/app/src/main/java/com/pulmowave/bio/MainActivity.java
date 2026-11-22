package com.pulmowave.bio;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(AudioSpirometryPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

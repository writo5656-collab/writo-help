package app.nihongo.academy;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Lets the web app ask the home-screen widget to redraw right away. */
@CapacitorPlugin(name = "StreakWidget")
public class WidgetPlugin extends Plugin {
    @PluginMethod
    public void refresh(PluginCall call) {
        StreakWidget.updateAll(getContext());
        call.resolve();
    }
}

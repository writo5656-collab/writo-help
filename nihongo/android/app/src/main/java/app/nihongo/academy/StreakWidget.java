package app.nihongo.academy;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import org.json.JSONObject;

/**
 * Home-screen widget showing the streak, freezes and today's 25-minute plan.
 * The app writes a small JSON summary into Capacitor Preferences
 * ("CapacitorStorage" / key "widget"); this widget only reads it.
 */
public class StreakWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, build(context));
    }

    public static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, StreakWidget.class));
        if (ids.length > 0) manager.updateAppWidget(ids, build(context));
    }

    private static RemoteViews build(Context context) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_streak);
        int streak = 0, freezes = 3, minutes = 0;
        boolean done = false, atRisk = false;
        String teacher = "";
        try {
            SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            String raw = prefs.getString("widget", null);
            if (raw != null) {
                JSONObject j = new JSONObject(raw);
                String day = j.optString("day", "");
                streak = j.optInt("streak", 0);
                freezes = j.optInt("freezes", 3);
                teacher = j.optString("teacher", "");
                // The summary is from the day it was written; on a new day today's minutes start at 0.
                String today = new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(new java.util.Date());
                if (today.equals(day)) {
                    minutes = j.optInt("minutes", 0);
                    done = j.optBoolean("done", false);
                } else if (streak > 0 && !j.optBoolean("done", false)) {
                    // Yesterday was not finished; the app will apply a freeze or reset when opened.
                }
                atRisk = !done && streak > 0;
            }
        } catch (Exception ignored) { }

        // Today's teacher: her picture (written by the app) and a little message.
        try {
            java.io.File face = new java.io.File(context.getFilesDir(), "widget_teacher.png");
            if (face.exists()) {
                android.graphics.Bitmap bmp = android.graphics.BitmapFactory.decodeFile(face.getAbsolutePath());
                if (bmp != null) {
                    v.setImageViewBitmap(R.id.w_face, bmp);
                    v.setViewVisibility(R.id.w_face, android.view.View.VISIBLE);
                    v.setViewVisibility(R.id.w_flag, android.view.View.GONE);
                }
            }
        } catch (Exception ignored) { }
        int hour = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY);
        String say;
        if (done) say = "おつかれさま！また明日ね";
        else if (atRisk && hour >= 20) say = "まだ間に合うよ！いっしょにやろう？";
        else if (minutes > 0) say = "いい調子！あと" + Math.max(1, 25 - minutes) + "分だよ";
        else if (hour < 11) say = "おはよう！今日もがんばろうね";
        else say = "今日もいっしょにがんばろう！";
        v.setTextViewText(R.id.w_name, teacher.isEmpty() ? "Today's teacher" : teacher + " · today's teacher");
        v.setTextViewText(R.id.w_say, say);

        v.setTextViewText(R.id.w_streak, String.valueOf(streak));
        v.setTextViewText(R.id.w_freezes, freezes + (freezes == 1 ? " freeze" : " freezes"));
        v.setTextViewText(R.id.w_plan, done ? "済 Today's 25 min done" : (minutes + " / 25 min today" + (atRisk ? " · finish before midnight!" : "")));
        v.setProgressBar(R.id.w_bar, 25, Math.min(25, minutes), false);

        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.w_root, pi);
        return v;
    }
}

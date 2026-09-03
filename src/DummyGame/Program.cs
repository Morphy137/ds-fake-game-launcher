using System;
using System.Drawing;
using System.IO;
using System.Threading;
using System.Windows.Forms;

namespace DummyGame
{
    internal static class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            string displayName = args.Length > 0 && !string.IsNullOrWhiteSpace(args[0])
                ? args[0]
                : "Game";

            bool minimizeToTray = true;
            bool startHidden = false;

            for (int i = 1; i < args.Length; i++)
            {
                var a = args[i].Trim();
                if (a.Equals("--no-tray", StringComparison.OrdinalIgnoreCase))
                    minimizeToTray = false;
                else if (a.Equals("--hidden", StringComparison.OrdinalIgnoreCase) || a.Equals("--start-hidden", StringComparison.OrdinalIgnoreCase))
                    startHidden = true;
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            var form = new Form
            {
                Text = displayName,
                Width = 480,
                Height = 200,
                StartPosition = FormStartPosition.CenterScreen
            };

            var label = new Label
            {
                Text = $"{displayName} (fake process for Discord)",
                Dock = DockStyle.Fill,
                TextAlign = ContentAlignment.MiddleCenter,
                Font = new Font(SystemFonts.DefaultFont.FontFamily, 11f, FontStyle.Regular)
            };

            form.Controls.Add(label);

            if (minimizeToTray)
            {
                form.Resize += (s, e) =>
                {
                    if (form.WindowState == FormWindowState.Minimized)
                    {
                        form.Hide();
                    }
                };
            }

            var listenerThread = new Thread(() =>
            {
                try
                {
                    using var reader = new StreamReader(Console.OpenStandardInput());
                    string? line;
                    while ((line = reader.ReadLine()) != null)
                    {
                        var cmd = line.Trim().ToUpperInvariant();
                        if (cmd == "SHOW")
                        {
                            form.BeginInvoke(new Action(() =>
                            {
                                form.Show();
                                form.WindowState = FormWindowState.Normal;
                                form.BringToFront();
                                form.Activate();
                            }));
                        }
                        else if (cmd == "HIDE")
                        {
                            form.BeginInvoke(new Action(() =>
                            {
                                form.Hide();
                            }));
                        }
                        else if (cmd == "QUIT" || cmd == "STOP")
                        {
                            Application.Exit();
                            break;
                        }
                    }
                }
                catch
                {
                    // ignore
                }
            });
            listenerThread.IsBackground = true;
            listenerThread.Start();

            if (startHidden)
            {
                form.WindowState = FormWindowState.Minimized;
                form.ShowInTaskbar = false;
                form.Load += (s, e) => form.Hide();
            }

            Application.Run(form);
        }
    }
}
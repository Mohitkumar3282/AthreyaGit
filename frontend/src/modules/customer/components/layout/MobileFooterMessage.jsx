import React, { useState, useEffect } from 'react';
import { useSettings } from '@core/context/SettingsContext';
import { customerApi } from '../../services/customerApi';

const MobileFooterMessage = () => {
    const { settings } = useSettings();
    const appName = settings?.appName || 'App';
    const [mediaUrl, setMediaUrl] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        customerApi.getHeroConfig({ pageType: "home" })
            .then((res) => {
                if (isMounted) {
                    const url = res?.data?.result?.mobileFooterUrl || res?.data?.mobileFooterUrl || "";
                    setMediaUrl(url);
                    setLoading(false);
                }
            })
            .catch(() => {
                if (isMounted) {
                    setLoading(false);
                }
            });
        return () => { isMounted = false; };
    }, []);

    if (loading || !mediaUrl) {
        return null;
    }

    const isVideo = mediaUrl.includes("/video/upload/") || /\.(mp4|webm|ogg|mov|m4v)($|\?)/i.test(mediaUrl);

    return (
        <div className="md:hidden w-full pb-20 pt-2 bg-transparent">
            <div className="w-full overflow-hidden border-y border-[#1a6e2e]/20 bg-white aspect-[21/9]">
                {isVideo ? (
                    <video
                        src={mediaUrl}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <img
                        src={mediaUrl}
                        alt="Footer Banner"
                        className="w-full h-full object-cover"
                    />
                )}
            </div>
        </div>
    );
};

export default MobileFooterMessage;


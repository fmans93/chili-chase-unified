export class ChiliZones {

    constructor() {

        this.zones = [

            {
                name:
                    "WORK ZONE",

                x: .25,
                y: .25,

                width: .50,
                height: .50,

                type:
                    "work"
            }

        ];
    }


    inside(
        track,
        zone,
        video
    ) {

        const zx =
            zone.x *
            video.videoWidth;

        const zy =
            zone.y *
            video.videoHeight;

        const zw =
            zone.width *
            video.videoWidth;

        const zh =
            zone.height *
            video.videoHeight;


        return (

            track.center.x >= zx &&

            track.center.x <=
                zx + zw &&

            track.center.y >= zy &&

            track.center.y <=
                zy + zh
        );
    }
}
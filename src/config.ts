import * as fs from 'fs';
import * as path from 'path';



export class Configuration {


    public static setConfigurationFilename(fname:string): string {
        let fn:string = path.dirname(__filename) + "/../" + fname;
        return fn;
    }

    public static readFileAsJSON(fname:string): string[] {
        let data:string = fs.readFileSync(fname).toString();
        return JSON.parse (data);
    }


}  
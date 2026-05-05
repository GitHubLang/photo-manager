"""
将 .cube LUT 嵌入 Lightroom 可直接导入的 .xmp 配置文件
"""
import base64, os, sys

def cube_to_lightroom_xmp(cube_path, output_path, profile_name="LUT Profile"):
    with open(cube_path, 'rb') as f:
        cube_data = f.read()
    b64 = base64.b64encode(cube_data).decode()

    xmp = '<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>\n'
    xmp += '<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="LUT Converter">\n'
    xmp += ' <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">\n'
    xmp += '  <rdf:Description rdf:about=""\n'
    xmp += '   xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/">\n'
    xmp += '   <crs:Profile>\n'
    xmp += '    <rdf:Description>\n'
    xmp += f'     <crs:Name>{profile_name}</crs:Name>\n'
    xmp += f'     <crs:ProfileName>{profile_name}</crs:ProfileName>\n'
    xmp += '     <crs:Look>\n'
    xmp += '      <rdf:Description>\n'
    xmp += '       <crs:Name>3D LUT</crs:Name>\n'
    xmp += '       <crs:Amount>1.0</crs:Amount>\n'
    xmp += '       <crs:UUID>' + profile_name.replace(' ', '_') + '</crs:UUID>\n'
    xmp += '       <crs:LUT>\n' + b64 + '\n       </crs:LUT>\n'
    xmp += '      </rdf:Description>\n'
    xmp += '     </crs:Look>\n'
    xmp += '    </rdf:Description>\n'
    xmp += '   </crs:Profile>\n'
    xmp += '  </rdf:Description>\n'
    xmp += ' </rdf:RDF>\n'
    xmp += '</x:xmpmeta>\n'
    xmp += '<?xpacket end="w"?>\n'

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(xmp)
    return output_path

if __name__ == '__main__':
    if len(sys.argv) >= 3:
        cube_to_lightroom_xmp(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "LUT Profile")
        print("OK:", sys.argv[2])
    else:
        print("Usage: python cube_to_xmp.py input.cube output.xmp [name]")

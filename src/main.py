import streamlit as st
from eisp import proxy_tasks
from chart import get_chart, bars_csai_amount
import numpy as np
import os
import pandas as pd

@st.fragment
def section_top():
    st.set_page_config(page_title="Visualização e Exploração de features", layout="wide")
    st.title("Visualização e Exploração de features")
    st.markdown("""
    Esta seção permite a visualização e exploração de features extraídas da RCPD. Assumindo que as features já foram extraídas e estão em um arquivo features ou features_all. 
                """)

def section_config():
    annotation_path = st.text_input("Caminho para o arquivo de anotação.", value="rcpd/rcpd_annotation_fix.csv")
    if annotation_path:
        if os.path.exists(annotation_path):
            st.session_state['annotation_path'] = annotation_path
            dfy = pd.read_csv(annotation_path)
            st.session_state['dfy'] = dfy
        else:
            st.error(f"O caminho '{annotation_path}' não existe. Por favor, insira um caminho válido.")
    folder_path = st.text_input("Caminho para as features", value="features/")
    if folder_path:
        if os.path.exists(folder_path):
            features_dict = {}
            features_vectors: proxy_tasks.FeatureVectors = proxy_tasks.FeatureVectors.from_files(folder_path)
            for feature_name in features_vectors.get_feature_names():
                features_dict[feature_name] = features_vectors.get_feature(feature_name)
            features_dict['All'] = np.concatenate(list(features_dict.values()), axis=1)
            st.session_state['features_dict'] = features_dict
            st.markdown("""
            Configurações:
            - **Features a plotar**: Escolha quais features deseja visualizar. Selecione "All" para visualizar todas as features concatenadas.
            """)
            selected_features = st.selectbox("Features a plotar", options=list(features_dict.keys()), index=len(features_dict)-1)
            st.session_state['selected_features'] = selected_features
        else:
            st.error(f"O caminho '{folder_path}' não existe. Por favor, insira um caminho válido.")
    st.session_state['generate_chart'] = False
    st.session_state['analyze_selection'] = False


@st.fragment
def section_chart():
    if 'features_dict_pca' not in st.session_state:
        st.session_state['features_dict_pca'] = {}

    pressed = st.button("Gerar gráfico")
    if pressed:
        st.session_state['generate_chart'] = True
    if st.session_state.get('generate_chart', False):
        if 'features_dict' not in st.session_state or 'dfy' not in st.session_state or 'selected_features' not in st.session_state:
            st.warning("Por favor, configure o caminho para as features e o arquivo de anotação na seção de configurações.")
            return

        chart = get_chart(preprend_img_path='rcpd/images', features_dict=st.session_state['features_dict'], dfy=st.session_state['dfy'], features_to_plot=st.session_state['selected_features'])
        st.altair_chart(chart, on_select="rerun", width="stretch", key="selection_box")
    
@st.fragment
def section_selection():
    st.markdown("""
    **Seleção de pontos**: Você pode selecionar pontos no gráfico usando a ferramenta de seleção.
    """)
    pressed = st.button("Analisar pontos selecionados")
    if pressed:
        st.session_state['analyze_selection'] = True
    if st.session_state.get('analyze_selection', False):
        if 'selection_box' not in st.session_state:
            st.warning("Por favor, selecione pontos no gráfico antes de analisar.")
            return
        
        x_selected = st.session_state['selection_box']['selection']['param_1']['x']
        y_selected = st.session_state['selection_box']['selection']['param_1']['y']
        selected_indices = []
        for i, point in enumerate(st.session_state['features_dict_pca'][st.session_state['selected_features']]):
            if x_selected[0] < point[0] < x_selected[1] and y_selected[0] < point[1] < y_selected[1]:
                selected_indices.append(i)

        if len(selected_indices) == 0:
            st.warning("Nenhum ponto selecionado. Por favor, selecione pontos no gráfico antes de analisar.")
            return
        dfy_selected = st.session_state['dfy'].iloc[selected_indices]

        st.write("Dados dos pontos selecionados:")
        st.altair_chart(bars_csai_amount(dfy_selected), width="stretch")




section_top()
section_config()
section_chart()
section_selection()